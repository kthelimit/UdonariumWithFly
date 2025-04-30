import { AuthToken, ChannelScope, nowInSec, SkyWayAuthToken, uuidV4 } from '@skyway-sdk/core';

export class SkyWayBackend {
  constructor(readonly url: string) { }

  async alive(): Promise<boolean> {
    return fetchStatus(this.url);
  }

  async createSkyWayAuthToken(channelName: string, peerId: string): Promise<string> {
    return fetchSkyWayAuthToken(this.url, channelName, peerId);
    //return createSkyWayAuthTokenMock(channelName, peerId);
  }
}

async function fetchStatus(url: string): Promise<boolean> {
  try {
    let api = new URL('/v1/status', url);
    let response = await fetch(api);

    return response.status === 200
  } catch (err) {
    console.error(err);
    return false;
  }
}

async function fetchSkyWayAuthToken(url: string, channelName: string, peerId: string): Promise<string> {
  try {
    let api = new URL('/v1/skyway2023/token', url);

    let body = JSON.stringify({
      formatVersion: 1,
      channelName: channelName,
      peerId: peerId,
    });

    let response = await fetch(api, { method: 'POST', body: body });

    if (response.status !== 200) return '';

    let jsonObj = await response.json();
    return jsonObj.token ?? '';
  } catch (err) {
    console.error(err);
    return '';
  }
}

/**
 * SkyWayAuthToken을 생성하는 목 구현.
 * 
 * **시크릿 키는 프론트엔드에서는 은닉되어 있어야 합니다. 이 구현을 실전 환경에서 운용하지 마십시오.**
 * 
 * 서버를 구축하지 않고 프론트엔드에서 SkyWayAuthToken을 생성한 경우,
 * 시크릿 키를 최종 사용자가 취득할 수 있기 때문에 누구나 임의의 Channel이나 Room을 생성하여 참여할 수 있는 등의 보안상의 문제가 발생합니다.
 * 
 * @param channelName 접속하는 채널의 명칭
 * @param peerId PeerId
 * @returns JWT
 */
async function createSkyWayAuthTokenMock(channelName: string, peerId: string): Promise<string> {
// 목 구현을 위해 애플리케이션 ID와 시크릿 키는 고정 값
// 실전 환경에서는 시크릿 키를 서버 등에 두고 은닉한다
  const _appId = '<SkyWay2023 Application ID>';
  const _secret = '<SkyWay2023 Secret key>';

  const lobbySize = 4;

  if (channelName.startsWith('udonarium-lobby-') || channelName.includes('*') || peerId.includes('*')) {
    throw new Error('Invalid Argument');
  }

  const channelMap: Map<string, ChannelScope> = new Map();
  const isPrivateRoom = channelName === peerId;

  channelMap.set(channelName, {
    name: channelName,
    actions: isPrivateRoom ? ['read', 'create', 'updateMetadata'] : ['read', 'create'],
    members: [
      {
        name: peerId,
        actions: ['write'],
        publication: {
          actions: ['write'],
        },
        subscription: {
          actions: ['write'],
        },
      },
      {
        name: '*',
        actions: ['signal'],
      },
    ],
  });

  const lobbyName = `udonarium-lobby-*-of-${lobbySize}`;
  channelMap.set(lobbyName, {
    name: lobbyName,
    actions: ['read', 'create'],
    members: [
      {
        name: peerId,
        actions: ['write'],
      },
    ],
  });

  let props: AuthToken = {
    jti: uuidV4(),
    iat: nowInSec(),
    exp: nowInSec() + 60 * 60 * 24,
    scope: {
      app: {
        id: _appId,
        turn: false,
        actions: ['read'],
        channels: Array.from(channelMap.values()),
      },
    },
    version: 2,
  };

  const token = new SkyWayAuthToken(props).encode(_secret);

  return token;
}
