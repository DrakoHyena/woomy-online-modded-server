import { worker, wrmHost, getHostRoomId } from "./host.js";

(async ()=>{
	console.log("# STARTING WRM CONNECTION")
	await wrmHost()

	console.log("# STARTING WORKER")
	await worker.start("growth.json", "[Node.JS] Growth", "Growth, Running on a Node.js Modded Server")
	
	console.log("🚀 Up and running with room id: "+await getHostRoomId())
})()