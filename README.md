# Starting
Install the npm packages:
`npm i`

Start the project:
`npm run start`

# Customization
You can customize anything to your liking and it will be reflected in game.
This excludes anything that's client sided such as custom shapes or images.
You can change the gamemode, server name, and server description in start.js.

# Converting a server file
Just paste
```
import * as fs from "node:fs"
import { parentPort } from "worker_threads"
```
at the top of the server.js file