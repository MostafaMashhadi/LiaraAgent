package cache

import (
	"testing"
	"time"
)

func TestLRUCache_GetSet(t *testing.T) {
	c := NewLRUCache(2, 1*time.Minute)

	c.Set("k1", "v1", 1*time.Minute)
	c.Set("k2", "v2", 1*time.Minute)

	val, found := c.Get("k1")
	if !found || val.(string) != "v1" {
		t.Errorf("expected k1 to be found with v1")
	}

	// Add 3rd item, k2 should be evicted (k1 was accessed recently)
	c.Set("k3", "v3", 1*time.Minute)

	_, foundK2 := c.Get("k2")
	if foundK2 {
		t.Errorf("expected k2 to have been evicted")
	}

	stats := c.Stats()
	if stats.Hits < 1 {
		t.Errorf("expected at least 1 hit, got %d", stats.Hits)
	}
}

func TestLRUCache_TTL(t *testing.T) {
	c := NewLRUCache(10, 10*time.Millisecond)

	c.Set("temp", "val", 10*time.Millisecond)
	time.Sleep(25 * time.Millisecond)

	_, found := c.Get("temp")
	if found {
		t.Errorf("expected temp to have expired")
	}
}
