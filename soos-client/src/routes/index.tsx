import * as React from 'react';
import {
  Entry,
  Lobby,
  LobbyLoader,
  GameViewLoader,
  GameViewWrapper,
} from '../features';

import { io } from 'socket.io-client';

export const AppRoutes = () => {
  const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
  const socket = io(serverUrl);

  const routes = [
    {
      path: '/',
      element: <Entry />,
    },
    {
      path: '/lobby/:gamecode',
      element: <Lobby socket={socket} />,
      //loader: LobbyLoader
    },
    {
      path: '/game/:gamecode',
      element: <GameViewWrapper socket={socket} />,
      //loader: GameViewLoader
    },
  ];

  return routes;
};
