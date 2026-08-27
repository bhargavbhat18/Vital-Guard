import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export const createStompClient = (onConnect, onError) => {
  const client = new Client({
    webSocketFactory: () => new SockJS('http://localhost:8000/ws'),
    debug: (str) => {
      console.log('[STOMP]', str);
    },
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
  });

  client.onConnect = onConnect;
  client.onStompError = onError;
  
  return client;
};
