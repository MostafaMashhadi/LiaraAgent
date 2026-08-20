package ws

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"sync"
)

const (
	wsGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

	OpContinuation = 0x0
	OpText         = 0x1
	OpBinary       = 0x2
	OpClose        = 0x8
	OpPing         = 0x9
	OpPong         = 0xA
)

// Conn represents an active WebSocket connection.
type Conn struct {
	netConn net.Conn
	bufr    *bufio.Reader
	bufw    *bufio.Writer
	writeMu sync.Mutex
	closed  bool
}

// StreamMessage represents incoming/outgoing WebSocket JSON messages.
type StreamMessage struct {
	Type          string      `json:"type"`                     // "chat", "token", "done", "error", "sources", "suggested_next"
	Message       string      `json:"message,omitempty"`        // User message or assistant response
	Token         string      `json:"token,omitempty"`          // Streaming token chunk
	SessionID     string      `json:"session_id,omitempty"`     // Session identifier
	Category      string      `json:"category,omitempty"`       // Optional category filter
	ToolExecuted  string      `json:"tool_executed,omitempty"`  // e.g. "analyze_error_log"
	Sources       interface{} `json:"sources,omitempty"`        // Cited sources
	SuggestedNext []string    `json:"suggested_next,omitempty"` // Suggested next steps
	DurationMs    int64       `json:"duration_ms,omitempty"`
	Error         string      `json:"error,omitempty"`
}

// Upgrade upgrades an HTTP connection to a WebSocket connection.
func Upgrade(w http.ResponseWriter, r *http.Request) (*Conn, error) {
	if r.Method != http.MethodGet {
		return nil, errors.New("websocket handshake must be GET")
	}

	key := r.Header.Get("Sec-WebSocket-Key")
	if key == "" {
		return nil, errors.New("missing Sec-WebSocket-Key header")
	}

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return nil, errors.New("webserver does not support hijacking")
	}

	netConn, bufRw, err := hijacker.Hijack()
	if err != nil {
		return nil, fmt.Errorf("hijack failed: %w", err)
	}

	// Compute accept hash
	h := sha1.New()
	h.Write([]byte(key + wsGUID))
	acceptKey := base64.StdEncoding.EncodeToString(h.Sum(nil))

	// Write handshake response
	response := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + acceptKey + "\r\n\r\n"

	if _, err := bufRw.WriteString(response); err != nil {
		netConn.Close()
		return nil, fmt.Errorf("failed to write handshake response: %w", err)
	}
	if err := bufRw.Flush(); err != nil {
		netConn.Close()
		return nil, fmt.Errorf("failed to flush handshake response: %w", err)
	}

	return &Conn{
		netConn: netConn,
		bufr:    bufRw.Reader,
		bufw:    bufRw.Writer,
	}, nil
}

// ReadMessage reads a complete text frame from the client.
func (c *Conn) ReadMessage() (int, []byte, error) {
	for {
		header, err := c.bufr.ReadByte()
		if err != nil {
			return 0, nil, err
		}

		fin := (header & 0x80) != 0
		opcode := int(header & 0x0F)

		lenByte, err := c.bufr.ReadByte()
		if err != nil {
			return 0, nil, err
		}

		isMasked := (lenByte & 0x80) != 0
		payloadLen := uint64(lenByte & 0x7F)

		if payloadLen == 126 {
			var extLen uint16
			if err := binary.Read(c.bufr, binary.BigEndian, &extLen); err != nil {
				return 0, nil, err
			}
			payloadLen = uint64(extLen)
		} else if payloadLen == 127 {
			if err := binary.Read(c.bufr, binary.BigEndian, &payloadLen); err != nil {
				return 0, nil, err
			}
		}

		var maskKey [4]byte
		if isMasked {
			if _, err := io.ReadFull(c.bufr, maskKey[:]); err != nil {
				return 0, nil, err
			}
		}

		payload := make([]byte, payloadLen)
		if _, err := io.ReadFull(c.bufr, payload); err != nil {
			return 0, nil, err
		}

		if isMasked {
			for i := uint64(0); i < payloadLen; i++ {
				payload[i] ^= maskKey[i%4]
			}
		}

		switch opcode {
		case OpPing:
			// Auto reply with Pong
			_ = c.WriteFrame(OpPong, payload)
			continue
		case OpPong:
			continue
		case OpClose:
			_ = c.WriteFrame(OpClose, nil)
			c.Close()
			return OpClose, nil, io.EOF
		case OpText, OpBinary:
			if !fin {
				// We currently support complete frames
				return opcode, payload, nil
			}
			return opcode, payload, nil
		default:
			continue
		}
	}
}

// ReadJSON reads a JSON message from the connection.
func (c *Conn) ReadJSON(v interface{}) error {
	_, data, err := c.ReadMessage()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}

// WriteFrame writes a standard WebSocket frame to the client.
func (c *Conn) WriteFrame(opcode int, payload []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	if c.closed {
		return errors.New("connection closed")
	}

	var header []byte
	header = append(header, byte(0x80|opcode)) // FIN + opcode

	payloadLen := len(payload)
	if payloadLen <= 125 {
		header = append(header, byte(payloadLen))
	} else if payloadLen <= 65535 {
		header = append(header, 126)
		lenBytes := make([]byte, 2)
		binary.BigEndian.PutUint16(lenBytes, uint16(payloadLen))
		header = append(header, lenBytes...)
	} else {
		header = append(header, 127)
		lenBytes := make([]byte, 8)
		binary.BigEndian.PutUint64(lenBytes, uint64(payloadLen))
		header = append(header, lenBytes...)
	}

	if _, err := c.bufw.Write(header); err != nil {
		return err
	}
	if payloadLen > 0 {
		if _, err := c.bufw.Write(payload); err != nil {
			return err
		}
	}

	return c.bufw.Flush()
}

// WriteText writes a UTF-8 text message.
func (c *Conn) WriteText(text string) error {
	return c.WriteFrame(OpText, []byte(text))
}

// WriteJSON serializes and sends a JSON message.
func (c *Conn) WriteJSON(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return c.WriteFrame(OpText, data)
}

// Close closes the underlying network connection.
func (c *Conn) Close() error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	if c.closed {
		return nil
	}
	c.closed = true
	return c.netConn.Close()
}
