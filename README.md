# Starting
Install the npm packages:
`npm i -g node-pre-gyp`
`npm i`

Start the project:
`npm run start`

# Converting a server file
Just paste
```
import * as fs from "node:fs"
import { parentPort } from "worker_threads"
```
at the top of the server.js file