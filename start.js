import { worker, wrmHost, getHostRoomId } from "./host.js";

(async ()=>{
	console.log("# STARTING WRM CONNECTION")
	await wrmHost()

	console.log("# STARTING WORKER")
	await worker.start("1v1.js", "[TESTING] 1v1", "Testing the new 1v1 gamemode. Fight a random player in a private arena.")
	
	console.log("🚀 Up and running with room id: "+await getHostRoomId())
})()