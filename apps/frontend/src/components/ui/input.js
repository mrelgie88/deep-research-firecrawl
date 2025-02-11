import React from "react";

/**
 * Basic Input component
 * - className, placeholder, etc. can be passed as props
 */
export function Input({ className = "", ...props }) {
  return <input className={`border p-2 rounded ${className}`} {...props} />;
}

/**
 * Basic Button component
 * - children is the button text or elements
 */
export function Button({ className = "", children, ...props }) {
  return (
    <button
      className={`px-4 py-2 bg-blue-500 text-white rounded ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
