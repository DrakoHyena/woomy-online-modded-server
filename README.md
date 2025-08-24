# Starting
Install the npm packages:
`npm i`

Start the project:
`npm run start`

# Customization
You can customize anything to your liking and it will be reflected in game.
This excludes anything that's client sided such as custom shapes or images.
You can change the gamemode, server name, and server description in start.js.

# Updating
First, get an updated copy of the "configs", "server", and "shared" folders from https://github.com/DrakoHyena/woomy-online-revitalized and replace the ones in this project.
Then, inside /server/server.js paste
```
import * as fs from "node:fs"
import { parentPort } from "worker_threads"
```
at the top of the server.js file.