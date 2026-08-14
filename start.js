import { worker, wrmHost, getHostRoomId } from "./host.js";

(async () => {
    console.log("# STARTING WRM CONNECTION")
    await wrmHost({
        RMUrl: "woomy.online", // woomy.online for non-local RM | localhost for local RM 
        RMPort: 443, // 443 for non-local RM | 3000 is the default for local RM
    }).catch((err) => console.error("Failed to start RM connection", err))

    console.log("# STARTING WORKER")
    await worker.start(
        "warfront.js", // gamemode (see configs folder for other gamemodes)
        "[OFFICAL] Warfront", // room name
        "A stable server hosted by the developer of the game.\n\nTry the new Chinhook tank!\n\nPing me (@drakohyena) in the discord if theres any issues!",
        99, // max players (note, player limit will intentionally be hidden if it's 99)
        20, // default bot amount
        "suckmyballs", // default host powers token
    )

    console.log("🚀 Up and running with room id: " + await getHostRoomId())
})()
