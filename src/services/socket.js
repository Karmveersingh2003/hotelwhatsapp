import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL || 'https://hotelwhatsapp.vercel.app/';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, { autoConnect: false });
  }
  return socket;
};

export const connectSocket = (role) => {
  const s = getSocket();
  if (!s.connected) s.connect();
  s.emit('joinDepartment', role);
  return s;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
    socket = null;
  }
};
