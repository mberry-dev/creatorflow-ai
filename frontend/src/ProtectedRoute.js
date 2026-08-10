import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ user, children }) {
  // FR-01.7: If not authenticated, redirect smoothly to login page
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the requested page (Dashboard)
  return children;
}

export default ProtectedRoute;