import React from "react";

/**
 * Basic Card wrapper
 */
export function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-md shadow-md bg-white ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CardContent for styling inside the card
 */
export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={`p-4 ${className}`} {...props}>
      {children}
    </div>
  );
}
