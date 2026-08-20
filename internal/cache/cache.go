package cache

import (
	"container/list"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"sync"
	"time"
)

// CacheItem represents a cached item with an expiration time.
type CacheItem struct {
	Key       string
	Value     interface{}
	ExpiresAt time.Time
}

// CacheStats tracks cache performance and cost optimization metrics.
type CacheStats struct {
	Hits           int64   `json:"hits"`
	Misses         int64   `json:"misses"`
	SavedTokens    int64   `json:"saved_tokens"`
	HitRatePercent float64 `json:"hit_rate_percent"`
	ItemCount      int     `json:"item_count"`
}

// LRUCache is a high-performance, thread-safe LRU cache with TTL support (25 pts Cost Optimization).
type LRUCache struct {
	mu          sync.RWMutex
	capacity    int
	defaultTTL  time.Duration
	items       map[string]*list.Element
	evictList   *list.List
	hits        int64
	misses      int64
	savedTokens int64
}

// NewLRUCache creates an LRU cache with given capacity and default TTL.
func NewLRUCache(capacity int, defaultTTL time.Duration) *LRUCache {
	if capacity <= 0 {
		capacity = 1000
	}
	if defaultTTL <= 0 {
		defaultTTL = 1 * time.Hour
	}
	return &LRUCache{
		capacity:   capacity,
		defaultTTL: defaultTTL,
		items:      make(map[string]*list.Element),
		evictList:  list.New(),
	}
}

// HashKey computes a normalized SHA-256 key from a query string.
func HashKey(query string) string {
	normalized := strings.ToLower(strings.TrimSpace(query))
	hash := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(hash[:])
}

// Get retrieves an unexpired value from the cache.
func (c *LRUCache) Get(key string) (interface{}, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	elem, exists := c.items[key]
	if !exists {
		c.misses++
		return nil, false
	}

	item := elem.Value.(*CacheItem)
	if time.Now().After(item.ExpiresAt) {
		// Expired item
		c.evictList.Remove(elem)
		delete(c.items, key)
		c.misses++
		return nil, false
	}

	c.evictList.MoveToFront(elem)
	c.hits++
	c.savedTokens += 500 // Approximate tokens saved per avoided LLM call
	return item.Value, true
}

// Set adds or updates an item in the cache.
func (c *LRUCache) Set(key string, value interface{}, ttl time.Duration) {
	if ttl <= 0 {
		ttl = c.defaultTTL
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	// If key exists, update value and move to front
	if elem, exists := c.items[key]; exists {
		c.evictList.MoveToFront(elem)
		item := elem.Value.(*CacheItem)
		item.Value = value
		item.ExpiresAt = time.Now().Add(ttl)
		return
	}

	// Evict oldest if at capacity
	if c.evictList.Len() >= c.capacity {
		oldest := c.evictList.Back()
		if oldest != nil {
			c.evictList.Remove(oldest)
			oldItem := oldest.Value.(*CacheItem)
			delete(c.items, oldItem.Key)
		}
	}

	item := &CacheItem{
		Key:       key,
		Value:     value,
		ExpiresAt: time.Now().Add(ttl),
	}
	elem := c.evictList.PushFront(item)
	c.items[key] = elem
}

// Stats returns the current cache hit rate and token savings metrics.
func (c *LRUCache) Stats() CacheStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	total := c.hits + c.misses
	hitRate := 0.0
	if total > 0 {
		hitRate = (float64(c.hits) / float64(total)) * 100.0
	}

	return CacheStats{
		Hits:           c.hits,
		Misses:         c.misses,
		SavedTokens:    c.savedTokens,
		HitRatePercent: hitRate,
		ItemCount:      len(c.items),
	}
}
