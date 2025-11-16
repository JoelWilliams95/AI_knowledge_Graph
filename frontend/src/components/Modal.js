import React, { useEffect } from 'react';

// A small, reusable modal that can either show a simple message or render children.
// If `duration` is provided (number in ms) the modal will auto-dismiss after that time.
const Modal = ({ isOpen, onClose, message, children, type = 'error', duration = 5000 }) => {
  useEffect(() => {
    if (isOpen && duration) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`modal modal-${type}`}>
      <div className="modal-content">
        {children ? children : <p>{message}</p>}
      </div>
    </div>
  );
};

export default Modal;