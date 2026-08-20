package web

import (
	_ "embed"
)

// IndexHTML is the embedded fallback UI used when web/dist has not been built yet.
//
//go:embed fallback/index.html
var IndexHTML []byte
