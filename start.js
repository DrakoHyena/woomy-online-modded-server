import { worker, wrmHost, getHostRoomId } from "./host.js";

(async ()=>{
	console.log("# STARTING WRM CONNECTION")
	await wrmHost()

	console.log("# STARTING WORKER")
	await worker.start("4tdm.json", "[Node.JS] 4TDM", "4TDM Running on a Node.js Modded Server")
	
	console.log("🚀 Up and running with room id: "+await getHostRoomId())
})()