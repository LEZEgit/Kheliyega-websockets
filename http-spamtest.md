bash

```bash
for i in {1..60}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/matches; done
```

powershell

```powershell
1..60 | ForEach-Object { (Invoke-WebRequest http://localhost:8000/matches -SkipHttpErrorCheck).StatusCode }
```
