### used in browser

```js
for (let i = 0; i < 10; i++) {
  const ws = new WebSocket("ws://localhost:8000/ws");
  ws.onopen = () => console.log(`Socket ${i} opened`);
  ws.onclose = (e) => console.log(`Socket ${i} closed: ${e.code} ${e.reason}`);
}
```

output

```text
Socket 0 opened
Socket 1 opened
Socket 2 opened
Socket 3 opened
Socket 4 opened
Socket 5 opened
Socket 6 opened
Socket 7 opened
Socket 8 opened
Socket 9 opened
Socket 5 closed: 1013 Rate limit exceeded
Socket 6 closed: 1013 Rate limit exceeded
Socket 7 closed: 1013 Rate limit exceeded
Socket 8 closed: 1013 Rate limit exceeded
Socket 9 closed: 1013 Rate limit exceeded
```
