import { worker, wrmHost, getHostRoomId } from "./host.js";

(async () => {
    console.log("# STARTING WRM CONNECTION")
    await wrmHost({
        RMUrl: "localhost", // woomy.online for non-local RM | localhost for local RM 
        RMPort: 3000, // 443 for non-local RM | 3000 is the default for local RM
    }).catch((err) => console.error("Failed to start RM connection", err))

    console.log("# STARTING WORKER")
    await worker.start(
        "warfront.js", // gamemode (see configs folder for other gamemodes)
        "[WOMS] Warfront", // room name
        "The default gamemode for the Woomy Online Modded Server\nhttps://github.com/DrakoHyena/woomy-online-modded-server\n(To change this, edit start.js)", // room description
        99, // max players (note, player limit will intentionally be hidden if it's 99)
        20, // default bot amount
        "roomhost", // default host powers token
    )

    console.log("🚀 Up and running with room id: " + await getHostRoomId())
})()
