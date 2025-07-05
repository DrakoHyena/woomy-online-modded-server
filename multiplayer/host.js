//
//
// ! YOU DO NOT NEED TO TOUCH THIS FILE !
//
//

import { Worker }  from "worker_threads"
import { NodePeer } from "./webrtc-patch.js";
import { fasttalk } from "./fasttalk.js";
import * as wsLib from "ws"

//
// PEER
//
const iceServers = [
  { hostname: 'stun.l.google.com', port: 19302 },
  { hostname: 'stun1.l.google.com', port: 19302 },
  { hostname: 'stun2.l.google.com', port: 19302 },
  { hostname: 'stun3.l.google.com', port: 19302 },
  { hostname: 'stun4.l.google.com', port: 19302 }
];
iceServers.fetchTurnCredentials = async function() {
  try {
    const response = await fetch('https://woomy.online/api/get-turn-credentials');
    if (!response.ok) {
      console.error(`Failed to fetch TURN credentials: ${response.statusText}`);
    }
    const turnConfig = await response.json();
    console.log("Successfully fetched TURN credentials.");
    return [{
		hostname: "74.208.44.199",
		port: 3478,
		username: turnConfig.username,
		password: turnConfig.password,
		relayType: "TurnUdp"
	}];
  } catch (error) {
    console.error("Could not get TURN credentials, continuing without them.", error);
    return []; // Return null so the connection can proceed without TURN
  }
}
class PeerWrapper {
	constructor(iceServersParam) {
		const servers = iceServers.concat(iceServersParam)
		this.peer = new NodePeer(crypto.randomUUID(), {
			iceServers: servers
		});
		this.conn = null;
		this.id = null;
		this.onmessage = undefined;
		this.onclose = undefined;

		this.initialized = new Promise((resolve, reject) => {
			this.peer.on('open', id => {
				this.id = id;
				resolve();
			});
			this.peer.on('error', (err)=>{
				console.log("Error initlaizing peer")
				reject(err)
			});
		});

		this._readyResolve = null;
		this.ready = new Promise(res => this._readyResolve = res);

		this.peer.on('connection', conn => this._handleConnection(conn));
	}

	_handleConnection(conn) {
		conn.on('open', () => {
			this.conn = conn;
			this._setupConn(conn);
			this._readyResolve?.();
		});
		conn.on('error', console.error);
	}

	connectTo(targetId) {
		const conn = this.peer.connect(targetId);
		return new Promise((resolve, reject) => {
			conn.on('open', () => {
				this.conn = conn;
				this._setupConn(conn);
				this._readyResolve?.();
				resolve();
			});
			conn.on('error', reject);
		});
	}

	_setupConn(conn) {
		conn.on('data', data => {
			//console.log(`[Peer ${this.id}] Received:`, data)
			if(this.onmessage) this.onmessage(data)
		});
		conn.on('close', () => {
			console.log(`[Peer ${this.id}] Connection closed`);
			if (this.conn === conn) this.conn = null;
			if(this.onclose) this.onclose()
		});
	}

	send(data) {
		if (this.conn?.open) {
			const dc = this.conn.dataChannel; // Access the raw WebRTC data channel
			const highWaterMark = 4 * 1024 * 1024; // 4MB threshold
			const checkInterval = 100; // ms

			const trySend = () => {
				if (dc.bufferedAmount() < highWaterMark) {
					this.conn.send(data);
					// console.log(`[Peer ${this.id}] Sent:`, data);
				} else {
					setTimeout(trySend, checkInterval);
				}
			};

			trySend();
		} else {
			console.warn(`[Peer ${this.id}] No open connection`);
		}
	}

	destroy() {
		this.conn?.close();
		this.peer.destroy();
		console.log(`[Peer ${this.id}] Destroyed`);
	}
}

//
// MULTIPLAYER
//
let roomWs = undefined;
const roomPeers = new Map();
let hostRoomId = undefined;

async function wrmHost() {
	roomWs = new wsLib.WebSocket(`wss://woomy.online/host`)
	let openPromise = new Promise((res, rej) => {
		roomWs.onopen = () => {
			console.log("Room socket opened with room manager")
			res()
		}
		roomWs.onerror = (err) => {
			console.log("Error opening room socket to room manager")
			rej(err)
		}
	})
	roomWs.onmessage = async (msg) => {
		try {
			const { type, data } = JSON.parse(msg.data)
			switch (type) {
				// Add timeout if its a fake request
				case "playerJoin":
					console.log("Accepting new peer connection")
					let peer = new PeerWrapper(await iceServers.fetchTurnCredentials())
					console.log("Initializing new peer connection")
					await peer.initialized;
					console.log("New peer connection initialized")
					peer.connectTo(data);
					console.log("Connecting to new peer")
					await peer.ready
					console.log("Connected to new peer")
					roomPeers.set(peer.id, peer)
					worker.postMessage({ type: "playerJoin", playerId: peer.id })
					peer.onclose = () => {
						worker.postMessage({ type: "playerDc", playerId: peer.id })
						roomPeers.delete(peer.id)
					}
					peer.onmessage = async (msg) => {
						const data = fasttalk.decode(msg)
						worker.postMessage({ type: "serverMessage", data: [peer.id, data] })
					}
					break;
				case "hostRoomId":
					hostRoomId = data
					break;
				case "ping":
					roomWs.send(JSON.stringify({ping:true}))
					break;
			}
		} catch (err) {
			console.error(err)
		}
	}
	roomWs.onclose = async () => {
		console.log("Room socket closed with room manager. Retrying in 5 seconds.")
		setTimeout(async ()=>{
			console.log("Retrying WRM connection...")
			await wrmHost().catch((e)=>console.error("Failed to restart", e));
			hostRoomId = await getHostRoomId();
		}, 5000)
	}
	return openPromise
}
async function getHostRoomId(){
	console.log("Waiting for host room id...")
	return new Promise((res, rej)=>{
		// I know it sucks
		// but its easier this way
		let interval = setInterval(()=>{
			if(!hostRoomId) return;
			res(hostRoomId)
			clearInterval(interval)
			console.log("...Got host room id")
		})
	})
}

//
// WORKER/SERVER
//
const worker = new Worker('./server.js');
worker.start = async function (gamemodeCode, gamemodeName) {
	worker.postMessage({
		type: "startServer",
		server: {
			suffix: gamemodeCode,
			gamemode: gamemodeName,
		}
	});
	let startPromise = new Promise((res, rej) => {
		worker.on("message", function (msgEvent) {
			const data = msgEvent;
			switch (data.type) {
				case "serverStarted":
					res();
					break;
				case "clientMessage":
					let peer = roomPeers.get(data.playerId);
					if(!peer){
						console.error(`Peer ${data.playerId} does not exist`)
						return;
					}
					peer.send(fasttalk.encode(data.data));
					break;

				case "updatePlayers":
					// WRM, RoomUpdatePlayers
					roomWs.send(JSON.stringify({
						players: data.players,
						name:  data.name||gamemodeCode,
						desc: data.desc
					}))
					break;
				case "serverStartText":
					console.log(`[STATUS MESSAGE] ${data.text} - ${data.tip}`)
					break;
			}
		})
	})
	return startPromise
}

export {worker, wrmHost, getHostRoomId}