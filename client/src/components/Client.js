import React from 'react';
import Avatar from 'react-avatar';

function Client({ username }) {
  const safeUsername = username ? username.toString() : "Unknown User";
  return (
    <div className="d-flex align-items-center mb-3">
      <Avatar name={safeUsername} size={50} round="14px" className="mr-3" />
      <span className='mx-2'>{safeUsername}</span>
    </div>
  );
}

export default Client;
