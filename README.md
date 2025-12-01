# Recommendations
- An okay internet speed (both upload and download matter, 3mb/s up and down is suffcient)
- Any NAT but symmetric (https://checkmynat.com)
- At least a low-medium end CPU
If you can't meet these it's not the end of the world. However, in the absolute worst cases, the game could become unplayable.

# Starting
Install Node.js:
https://nodejs.org/

Open an editor or terminal in the folder:
Windows:
- windows key+r
- Type cmd
- Hit enter
- cd C:\entire\path\to\the\woomy\folder (you may need to find this in file explorer first)


Install the npm packages:
`npm i`

Start the project:
`npm run start`

# Customization
You can customize anything to your liking and it will be reflected in game.
This excludes anything that is purely client sided.
You can change the gamemode, server name, and server description in start.js.

# Updating
First, get an updated copy of the "configs", "server", and "shared" folders from https://github.com/DrakoHyena/woomy-online and replace the ones in this project.
Then, at the very top of /server/server.js, paste:
```
import * as fs from "node:fs"
import { parentPort } from "worker_threads"
```