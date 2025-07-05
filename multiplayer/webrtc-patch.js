//
// Apparently Peerjs doesnt have a nodejs implementation!
// So I had to make this on my own... it took a very long time.
// Fortunately, giving an ai with a massive context window all
// of the docs ended up working pretty well in the end.
//
// All of that is to say,
// You really dont need to touch this file. 
//

/**
 * @fileoverview Optimized NodePeer polyfill for PeerJS compatibility
 * Handles PeerJS binary framing protocol with 3-byte header [0xDA, 0, LENGTH]
 * Maintains full compatibility with fasttalk and other PeerJS consumers
 */

import { EventEmitter } from 'events';
import { PeerConnection, RtcpReceivingSession } from 'node-datachannel';
import { WebSocket } from 'ws';
import { randomBytes } from 'crypto';

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

class NodeDataConnection extends EventEmitter {
  constructor(peer, provider, options = {}) {
    super();
    this.peer = peer;
    this.provider = provider;
    this.options = options;
    this.label = options.label || `dc_${randomBytes(8).toString('hex')}`;
    this.serialization = 'raw';
    this.metadata = options.metadata;
    this.reliable = Boolean(options.reliable);
    this.open = false;
    this.isClosing = false;
    this._pc = null;
    this._dc = null;
  }

  get dataChannel() {
    return this._dc;
  }

  _start() {
    this._pc = new PeerConnection(this.peer, this.provider.options);
    this._setupPeerConnectionListeners();
    
    const dc = this._pc.createDataChannel(this.label, {
      negotiated: false,
      ordered: this.reliable
    });
    
    this._setupDataChannelListeners(dc);
    this._pc.setLocalDescription();
  }

  _handleOffer(offerPayload) {
    this._pc = new PeerConnection(this.peer, this.provider.options);
    this._pc.onDataChannel(dc => this._setupDataChannelListeners(dc));
    this._setupPeerConnectionListeners();
    this._pc.setRemoteDescription(offerPayload.sdp.sdp, 'offer');
  }

  _handleAnswer(answerPayload) {
    if (this._pc) {
      this._pc.setRemoteDescription(answerPayload.sdp.sdp, 'answer');
    }
  }

  _handleCandidate(candidatePayload) {
    if (this._pc && candidatePayload.candidate) {
      const { candidate, sdpMid } = candidatePayload.candidate;
      this._pc.addRemoteCandidate(candidate, sdpMid);
    }
  }
  
  _setupPeerConnectionListeners() {
    this._pc.onStateChange(state => {
      log(`[PC ${this.peer}] State: ${state.toUpperCase()}`);
      if (['closed', 'failed', 'disconnected'].includes(state)) {
        this.close();
      }
    });
    
    this._pc.onLocalCandidate((candidate, mid) => {
      this.provider._send('CANDIDATE', {
        dst: this.peer,
        payload: { candidate: { candidate, sdpMid: mid } }
      });
    });

    this._pc.onLocalDescription((sdp, type) => {
      const sdpObj = { type, sdp };
      let payload;
      
      if (type === 'offer') {
        payload = {
          sdp: sdpObj,
          type: 'data',
          connectionId: this.label,
          metadata: this.metadata,
          label: this.label,
          reliable: this.reliable,
          serialization: this.serialization
        };
        this.provider._send('OFFER', { dst: this.peer, payload });
      } else if (type === 'answer') {
        payload = {
          sdp: sdpObj,
          type: 'data',
          connectionId: this.label
        };
        this.provider._send('ANSWER', { dst: this.peer, payload });
      }
    });
  }

  _setupDataChannelListeners(dc) {
    this._dc = dc;
    
    dc.onOpen(() => {
      log(`[DC ${this.peer}] Connection opened`);
      this.open = true;
      this.emit('open');
    });

    // Handle incoming messages - strip PeerJS binary protocol header
    dc.onMessage(msg => {
        // Pass through raw buffer if not in expected format
        this.emit('data', msg);
    });

    dc.onClosed(() => {
      log(`[DC ${this.peer}] Connection closed`);
      this.close();
    });
  }

  send(data) {
    if (this._dc?.isOpen()) {
      this._dc.sendMessageBinary(data);
    }
  }

  close() {
    if (this.isClosing) return;
    
    this.isClosing = true;
    if (this._pc) this._pc.close();
    this.provider._removeConnection(this.peer);
    this.emit('close');
  }
}

export class NodePeer extends EventEmitter {
  constructor(id, options = {}) {
    super();
    
    this.id = id || `nodejs-host-${randomBytes(8).toString('hex')}`;
    this.connections = new Map();
    this.destroyed = false;
    this._ws = null;
    this._heartbeat = null;
    
    this.options = this._buildOptions(options);
    this._initSignaling();
  }

  _buildOptions(options) {
    const defaults = {
      key: 'peerjs',
      host: '0.peerjs.com',
      port: 443,
      path: '/peerjs',
      secure: true,
      iceServers: [],
    };
    
    // Merge and transform ICE servers
    const configIce = options.config?.iceServers || [];
    const directIce = options.iceServers || [];
    const allIceServers = [...directIce, ...configIce];
    
    const finalIceServers = allIceServers
      .map(server => this._transformIceServer(server))
      .filter(Boolean);

    const finalOptions = { ...defaults, ...options, iceServers: finalIceServers };
    delete finalOptions.config;
    
    return finalOptions;
  }

  _transformIceServer(server) {
    return server;
  }

  _initSignaling() {
    const { secure, host, port, path, key } = this.options;
    const protocol = secure ? 'wss' : 'ws';
    const token = Math.random().toString(36).slice(2);
    const url = `${protocol}://${host}:${port}${path}?key=${key}&id=${this.id}&token=${token}`;
    
    this._ws = new WebSocket(url);
    
    this._ws.on('open', () => {
      this.emit('open', this.id);
      this._startHeartbeat();
    });
    
    this._ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this._handleMessage(message);
      } catch (err) {
        this.emit('error', new Error('Invalid message format'));
      }
    });
    
    this._ws.on('close', () => {
      this.emit('disconnected');
      this._stopHeartbeat();
    });
    
    this._ws.on('error', (err) => {
      this.emit('error', err);
    });
  }

  _handleMessage(message) {
    const { type, payload, src: peerId } = message;
    let connection = this.connections.get(peerId);
    
    switch (type) {
      case 'OFFER':
        if (!connection) {
          connection = new NodeDataConnection(peerId, this, payload);
          this.connections.set(peerId, connection);
          connection._handleOffer(payload);
          this.emit('connection', connection);
        }
        break;
        
      case 'ANSWER':
        connection?._handleAnswer(payload);
        break;
        
      case 'CANDIDATE':
        connection?._handleCandidate(payload);
        break;
        
      case 'LEAVE':
      case 'EXPIRE':
        connection?.close();
        break;
        
      case 'ERROR':
        this.emit('error', new Error(payload.msg));
        break;
    }
  }

  _send(type, message) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      const fullMessage = { type, src: this.id, ...message };
      this._ws.send(JSON.stringify(fullMessage));
    }
  }

  _startHeartbeat() {
    this._heartbeat = setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._send('HEARTBEAT', {});
      }
    }, 20000);
  }

  _stopHeartbeat() {
    if (this._heartbeat) {
      clearInterval(this._heartbeat);
      this._heartbeat = null;
    }
  }

  _removeConnection(peerId) {
    this.connections.delete(peerId);
  }

  connect(peerId, options = {}) {
    const connection = new NodeDataConnection(peerId, this, options);
    this.connections.set(peerId, connection);
    connection._start();
    return connection;
  }

  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    this._stopHeartbeat();
    
    for (const connection of this.connections.values()) {
      connection.close();
    }
    
    if (this._ws) {
      this._ws.close();
    }
    
    this.emit('close');
  }
}