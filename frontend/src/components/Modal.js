import React, { useEffect, useState } from 'react';

// Enhanced modal with stable animations and better UX
const Modal = ({ isOpen, onClose, message, children, type = 'error', duration }) => {
  // Set default duration based on modal type
  // Profile modals don't auto-close, others do after 5 seconds
  const defaultDuration = type === 'profile' ? 0 : 5000;
  const actualDuration = duration !== undefined ? duration : defaultDuration;
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setIsAnimating(true);

      // Auto-dismiss timer (if duration provided and > 0)
      if (actualDuration > 0) {
        const timer = setTimeout(() => {
          handleClose();
        }, actualDuration);
        return () => clearTimeout(timer);
      }
    } else {
      handleClose();
    }
  }, [isOpen, actualDuration]);

  const handleClose = () => {
    setIsAnimating(false);
    // Wait for animation to complete before hiding
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300); // Match CSS animation duration
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div
      className={`modal modal-${type} ${isAnimating ? 'modal-visible' : 'modal-hidden'}`}
      onClick={(e) => {
        // Close modal when clicking on backdrop (outside content)
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="modal-content">
        {type !== 'profile' && (
          <button
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            ×
          </button>
        )}
        {children ? children : <p>{message}</p>}
      </div>
    </div>
  );
};

export default Modal;