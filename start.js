import { worker, wrmHost, getHostRoomId } from "./host.js";

(async ()=>{
	console.log("# STARTING WRM CONNECTION")
	await wrmHost({
		// TODO: didnt work in testing, if you can make it work, submit a pull request while youre at it, you'll need to edit host.js
		//localRM: true, // Uncomment if you're hosting your own room manager
	})

	console.log("# STARTING WORKER")
	await worker.start(
		"growth.json", // gamemode (see configs folder for other gamemodes)
		"[WOMS] Growth", // room name
		"The default gamemode for the Woomy Online Modded Server\nhttps://github.com/DrakoHyena/woomy-online-modded-server\n(To change this, edit start.js)", // room description
		99, // max players (note, player limit will intentionally be hidden if it's 99)
		20, // default bot amount
	)
	
	console.log("🚀 Up and running with room id: "+await getHostRoomId())
})()