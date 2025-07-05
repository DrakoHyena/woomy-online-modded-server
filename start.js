import { worker, wrmHost, getHostRoomId } from "./multiplayer/host.js";

(async ()=>{
	console.log("# STARTING WORKER")
	await worker.start("4tdm.json", "Test Name")

	console.log("# STARTING WRM CONNECTION")
	await wrmHost()
	
	console.log("🚀 Up and running with room id: "+await getHostRoomId())
})()