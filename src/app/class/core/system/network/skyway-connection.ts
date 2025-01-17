import { compressAsync, decompressAsync } from '../util/compress';
import { MessagePack } from '../util/message-pack';
import { setZeroTimeout } from '../util/zero-timeout';
import { Connection, ConnectionCallback } from './connection';
import { PeerContext } from './peer-context';
import { PeerSessionGrade } from './peer-session-state';
import { SkyWayDataConnection } from './skyway-data-connection';
import { CandidateType } from './webrtc-stats';

// @types/skywayを使用すると@types/webrtcが定義エラーになるので代替定義
declare var Peer;
declare module PeerJs {
  export type Peer = any;
  export type DataConnection = any;
}

interface DataContainer {
  data: Uint8Array;
  peers?: string[];
  ttl: number;
  isCompressed?: boolean;
}

export class SkyWayConnection implements Connection {
  get peerId(): string { return this.peerContext ? this.peerContext.peerId : '???'; }

  private _peerIds: string[] = [];
  get peerIds(): string[] { return this._peerIds }

  peerContext: PeerContext;
  readonly peerContexts: PeerContext[] = [];
  readonly callback: ConnectionCallback = new ConnectionCallback();
  bandwidthUsage: number = 0;

  private key: string = '';
  private peer: PeerJs.Peer;
  private connections: SkyWayDataConnection[] = [];

  private listAllPeersCache: string[] = [];
  private httpRequestInterval: number = performance.now() + 500;

  private queue: Promise<any> = Promise.resolve();

  private relayingPeerIds: Map<string, string[]> = new Map();
  private maybeUnavailablePeerIds: Set<string> = new Set();

  open(peerId: string)
  open(userId: string, roomId: string, roomName: string, password: string)
  open(...args: any[]) {
    console.log('open', args);
    if (args.length === 0) {
      this.peerContext = PeerContext.create(PeerContext.generateId());
    } else if (args.length === 1) {
      this.peerContext = PeerContext.create(args[0]);
    } else {
      this.peerContext = PeerContext.create(args[0], args[1], args[2], args[3]);
    }
    this.openPeer();
  }

  close() {
    if (this.peer) this.peer.destroy();
    this.disconnectAll();
    this.peer = null;
    this.peerContext = null;
  }

  connect(peerId: string): boolean {
    if (!this.shouldConnect(peerId)) return false;

    let conn: SkyWayDataConnection = new SkyWayDataConnection(this.peer.connect(peerId, {
      serialization: 'none',
      metadata: { sendFrom: this.peerId }
    }));

    this.openDataConnection(conn);
    return true;
  }

  private shouldConnect(peerId: string): boolean {
    if (!this.peerContext || !this.peer || !this.peerId) {
      console.log('connect() is Fail. ID가 배당될 때까지 기다려');
      return false;
    }

    if (this.peerId === peerId) {
      console.log('connect() is Fail. ' + peerId + ' is me.');
      return false;
    }

    if (this.findDataConnection(peerId)) {
      console.log('connect() is Fail. <' + peerId + '> is already connecting.');
      return false;
    }

    if (peerId && peerId.length && peerId !== this.peerId) return true;
    return false;
  }

  disconnect(peerId: string): boolean {
    let conn = this.findDataConnection(peerId)
    if (!conn) return false;
    this.closeDataConnection(conn);
    return true;
  }

  disconnectAll() {
    console.log('<closeAllDataConnection()>');
    for (let conn of this.connections.concat()) {
      this.closeDataConnection(conn);
    }
  }

  send(data: any, sendTo?: string) {
    if (this.connections.length < 1) return;
    let container: DataContainer = {
      data: MessagePack.encode(data),
      ttl: 1
    }

    let byteLength = container.data.byteLength;
    this.bandwidthUsage += byteLength;
    this.queue = this.queue.then(() => new Promise<void>((resolve, reject) => {
      setZeroTimeout(async () => {
        if (1 * 1024 < container.data.byteLength) {
          let compressed = await compressAsync(container.data);
          if (compressed.byteLength < container.data.byteLength) {
            container.data = compressed;
            container.isCompressed = true;
          }
        }
        if (sendTo) {
          this.sendUnicast(container, sendTo);
        } else {
          this.sendBroadcast(container);
        }
        this.bandwidthUsage -= byteLength;
        return resolve();
      });
    }));
  }

  private sendUnicast(container: DataContainer, sendTo: string) {
    container.ttl = 0;
    let conn = this.findDataConnection(sendTo);
    if (conn && conn.open) conn.send(container);
  }

  private sendBroadcast(container: DataContainer) {
    for (let conn of this.connections) {
      if (conn.open) conn.send(container);
    }
  }

  setApiKey(key: string) {
    if (this.key !== key) console.log('Key Change');
    this.key = key;
  }

  listAllPeers(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!this.peer) return resolve([]);
      let now = performance.now();
      if (now < this.httpRequestInterval) {
        console.warn('httpRequestInterval... ' + (this.httpRequestInterval - now));
        resolve(this.listAllPeersCache.concat());
        return;
      }
      this.httpRequestInterval = now + 6000;
      this.peer.listAllPeers((list) => {
        this.listAllPeersCache = list.concat();
        resolve(list);
      });
    });
  }

  private openPeer() {
    if (this.peer) {
      console.warn('It is already opened.');
      this.close();
    }
    let peer = new Peer(this.peerContext.peerId, { key: this.key });// SkyWay
    peer.on('open', id => {
      console.log('My peer ID is: ' + id);
      if (!this.peerContext || this.peerContext.peerId !== id) {
        this.peerContext = PeerContext.parse(id);
      }
      this.peerContext.isOpen = true;
      console.log('My peer Context', this.peerContext);
      if (this.callback.onOpen) this.callback.onOpen(this.peerId);
    });

    peer.on('close', () => {
      console.log('Peer close');
      if (this.peerContext && this.peerContext.isOpen) {
        this.peerContext.isOpen = false;
        if (this.callback.onClose) this.callback.onClose(this.peerId);
      }
    });

    peer.on('connection', conn => {
      this.openDataConnection(new SkyWayDataConnection(conn));
    });

    peer.on('error', err => {
      console.error('<' + this.peerId + '> ' + err.type + ' => ' + err.message);
      let errorMessage = `${this.getSkyWayErrorMessage(err.type)}\n\n${err.type}: ${err.message}`;
      switch (err.type) {
        case 'peer-unavailable':
          let peerId = /"(.+)"/.exec(err.message)[1];
          this.disconnect(peerId);
          break;
        case 'disconnected':
        case 'socket-error':
        case 'unavailable-id':
        case 'authentication':
        case 'server-error':
          if (this.peerContext && this.peerContext.isOpen) {
            this.close();
            if (this.callback.onClose) this.callback.onClose(this.peerId);
          }
          break;
        default:
          break;
      }
      if (this.callback.onError) this.callback.onError(this.peerId, err.type, errorMessage, err);
    });
    this.peer = peer;
  }

  private openDataConnection(conn: SkyWayDataConnection) {
    if (this.addDataConnection(conn) === false) return;

    let index = this.connections.indexOf(conn);
    let context: PeerContext = null;
    if (0 <= index) context = this.peerContexts[index];

    this.maybeUnavailablePeerIds.add(conn.remoteId);
    conn.on('data', data => {
      this.onData(conn, data);
    });
    conn.on('open', () => {
      this.maybeUnavailablePeerIds.delete(conn.remoteId);
      if (context) context.isOpen = true;
      this.updatePeerList();
      if (this.callback.onConnect) this.callback.onConnect(conn.remoteId);
    });
    conn.on('close', () => {
      this.closeDataConnection(conn);
      if (this.callback.onDisconnect) this.callback.onDisconnect(conn.remoteId);
    });
    conn.on('error', () => {
      this.closeDataConnection(conn);
    });
    conn.on('stats', () => {
      let deltaTime = performance.now() - conn.timestamp;
      let healthRate = deltaTime <= 10000 ? 1 : 5000 / ((deltaTime - 10000) + 5000);
      let ping = healthRate < 1 ? deltaTime : conn.ping;
      let pingRate = 500 / (ping + 500);

      context.session.health = healthRate;
      context.session.ping = ping;
      context.session.speed = pingRate * healthRate;

      switch (conn.candidateType) {
        case CandidateType.HOST:
          context.session.grade = PeerSessionGrade.HIGH;
          break;
        case CandidateType.SRFLX:
        case CandidateType.PRFLX:
          context.session.grade = PeerSessionGrade.MIDDLE;
          break;
        case CandidateType.RELAY:
          context.session.grade = PeerSessionGrade.LOW;
          break;
        default:
          context.session.grade = PeerSessionGrade.UNSPECIFIED;
          break;
      }
      context.session.description = conn.candidateType;
    });
  }

  private closeDataConnection(conn: SkyWayDataConnection) {
    conn.close();
    let index = this.connections.indexOf(conn);
    if (0 <= index) {
      console.log(conn.remoteId + ' is えんいー' + 'index:' + index + ' length:' + this.connections.length);
      this.connections.splice(index, 1);
      this.peerContexts.splice(index, 1);
    }
    this.relayingPeerIds.delete(conn.remoteId);
    this.relayingPeerIds.forEach(peerIds => {
      let index = peerIds.indexOf(conn.remoteId);
      if (0 <= index) peerIds.splice(index, 1);
    });
    console.log('<close()> Peer:' + conn.remoteId + ' length:' + this.connections.length + ':' + this.peerContexts.length);
    this.updatePeerList();
  }

  private addDataConnection(conn: SkyWayDataConnection): boolean {
    let existConn = this.findDataConnection(conn.remoteId);
    if (existConn !== null) {
      console.log('add() is Fail. ' + conn.remoteId + ' is already connecting.');
      if (existConn !== conn) {
        if (existConn.metadata.sendFrom < conn.metadata.sendFrom) {
          this.closeDataConnection(conn);
        } else {
          this.closeDataConnection(existConn);
          this.addDataConnection(conn);
          return true;
        }
      }
      return false;
    }
    this.connections.push(conn);
    this.peerContexts.push(PeerContext.parse(conn.remoteId));
    console.log('<add()> Peer:' + conn.remoteId + ' length:' + this.connections.length);
    return true;
  }

  private findDataConnection(peerId: string): SkyWayDataConnection {
    for (let conn of this.connections) {
      if (conn.remoteId === peerId) {
        return conn;
      }
    }
    return null;
  }

  private onData(conn: SkyWayDataConnection, container: DataContainer) {
    if (container.peers && 0 < container.peers.length) this.onUpdatePeerList(conn, container);
    if (0 < container.ttl) this.onRelay(conn, container);
    if (this.callback.onData) {
      let byteLength = container.data.byteLength;
      this.bandwidthUsage += byteLength;
      this.queue = this.queue.then(() => new Promise<void>((resolve, reject) => {
        setZeroTimeout(async () => {
          let data = container.isCompressed ? await decompressAsync(container.data) : container.data;
          this.callback.onData(conn.remoteId, MessagePack.decode(data));
          this.bandwidthUsage -= byteLength;
          return resolve();
        });
      }));
    }
  }

  private onRelay(conn: SkyWayDataConnection, container: DataContainer) {
    container.ttl--;

    let relayingPeerIds: string[] = this.relayingPeerIds.get(conn.remoteId);
    if (relayingPeerIds == null) return;

    for (let peerId of relayingPeerIds) {
      let conn = this.findDataConnection(peerId);
      if (conn && conn.open) {
        console.log('<' + peerId + '>전송하지 않으면・・・');
        conn.send(container);
      }
    }
  }

  private onUpdatePeerList(conn: SkyWayDataConnection, container: DataContainer) {
    let relayingPeerIds: string[] = [];
    let unknownPeerIds: string[] = [];

    let diff = diffArray(this._peerIds, container.peers);
    relayingPeerIds = diff.diff1;
    unknownPeerIds = diff.diff2;
    this.relayingPeerIds.set(conn.remoteId, relayingPeerIds);
    container.peers = container.peers.concat(relayingPeerIds);

    if (unknownPeerIds.length) {
      for (let peerId of unknownPeerIds) {
        if (!this.maybeUnavailablePeerIds.has(peerId) && this.connect(peerId)) {
          console.log('auto connect to unknown Peer <' + peerId + '>');
        }
      }
    }
  }

  private updatePeerList(): string[] {
    let peerIds: string[] = [];
    for (let conn of this.connections) {
      if (conn.open) peerIds.push(conn.remoteId);
    }
    peerIds.push(this.peerId);
    peerIds.sort(function (a, b) {
      if (a > b) return 1;
      if (a < b) return -1;
      return 0;
    });

    this._peerIds = peerIds;

    console.log('<update()>', peerIds);
    this.notifyPeerList();
    return peerIds;
  }

  private notifyPeerList() {
    if (this.connections.length < 1) return;
    let container: DataContainer = {
      data: MessagePack.encode([]),
      peers: this._peerIds,
      ttl: 1
    }
    this.sendBroadcast(container);
  }

  private getSkyWayErrorMessage(errType: string): string {
    switch (errType) {
      case 'room-error': return 'SkyWay Room API에 문제가 발생했습니다.';
      case 'permission': return '해당 SkyWay Room의 이용이 허가되지 않았습니다.';
      case 'list-error': return 'SkyWay listAllPeers API 가 Disabled 입니다.';
      case 'disconnected': return 'SkyWay의 시그널링 서버에 접속되어 있지 않습니다.';
      case 'socket-error': return 'SkyWay의 시그널린 서버와의 통신에 문제가 발생했습니다.';
      case 'invalid-id': return 'Peer ID가 맞지 않습니다.';
      case 'unavailable-id': return '그 Peer ID는 이미 사용되고 있습니다.';
      case 'peer-unavailable': return '그 Peer 아이디는 이용할 수 없습니다.';
      case 'invalid-key': return 'SkyWay API 키가 무효입니다.';
      case 'invalid-domain': return 'SkyWay API 키에 현재 도메인이 등록되어 있지 않습니다.';
      case 'authentication': return '인증 오류입니다';
      case 'server-error': return 'SkyWay의 시그널링 서버와의 접속 중에 문제가 있었습니다. 잠시 기다렸다가 재시도 해주세요.';
      case 'sfu-client-not-supported': return '이 클라이언트는 SFU의 사용을 서포트하고 있지 않습니다. 최신 버전의 Google Chrome을 사용해주세요.';
      case 'peer-unavailable': return 'Peer에 데이터를 송신할 수 없었습니다. Peer ID가 맞는지 확인해주세요.';
      case 'signaling-limited': return '시그널링 횟수가 무상이용한도를 초과하고 있기 때문에 모든 기능을 이용할 수 없습니다.（SkyWay Community Edition만）';
      case 'sfu-limited': return 'SFU 서버의 이용량이 무상이용한도를 초과하고 있기 때문에 SFU의 기능을 이용할 수 없습니다.（SkyWay Community Edition만）';
      case 'turn-limited': return 'TURN 서버의 이용량이 무상이용한도를 초과하고 있기 때문에 TURN의 기능을 이용할 수 없습니다.（SkyWay Community Edition만）\n이 상태로는 일부 사용자의 접속에 문제가 발생할 가능성이 있습니다.';
      default: return 'SkyWay에 관한 알 수 없는 오류가 발생했습니다.';
    }
  }
}

function diffArray<T>(array1: T[], array2: T[]): { diff1: T[], diff2: T[] } {
  let diff1: T[] = [];
  let diff2: T[] = [];

  let includesInArray1: boolean = false;
  let includesInArray2: boolean = false;

  for (let item of array1.concat(array2)) {
    includesInArray1 = array1.includes(item);
    includesInArray2 = array2.includes(item);
    if (includesInArray1 && !includesInArray2) {
      diff1.push(item);
    } else if (!includesInArray1 && includesInArray2) {
      diff2.push(item);
    }
  }
  return { diff1: diff1, diff2: diff2 };
}
