import React from 'react';
import { AppLayout } from '../components/layout/app-layout';
import { RoomPlanner } from '../features/room-planner';
export function App() {
  return <AppLayout><RoomPlanner /></AppLayout>;
}
