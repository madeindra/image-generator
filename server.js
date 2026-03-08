#!/usr/bin/env node
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!OPENAI_API_KEY && !GEMINI_API_KEY) {
    console.warn('Warning: neither OPENAI_API_KEY nor GEMINI_API_KEY is set.');
}

const app = express();

app.use('/api/openai', createProxyMiddleware({
    target: 'https://api.openai.com',
    changeOrigin: true,
    pathRewrite: { '^/api/openai': '' },
    on: {
        proxyReq: (proxyReq) => {
            proxyReq.setHeader('Authorization', `Bearer ${OPENAI_API_KEY}`);
        },
    },
}));

app.use('/api/gemini', createProxyMiddleware({
    target: 'https://generativelanguage.googleapis.com',
    changeOrigin: true,
    pathRewrite: { '^/api/gemini': '' },
    on: {
        proxyReq: (proxyReq) => {
            proxyReq.setHeader('x-goog-api-key', GEMINI_API_KEY);
        },
    },
}));

app.use(express.static(path.join(__dirname)));

const port = process.env.PORT || 8080;
app.listen(port, 'localhost', () => {
    console.log(`Serving at http://localhost:${port}`);
    console.log(`  OPENAI_API_KEY: ${OPENAI_API_KEY ? '(set)' : '(not set)'}`);
    console.log(`  GEMINI_API_KEY: ${GEMINI_API_KEY ? '(set)' : '(not set)'}`);
});
