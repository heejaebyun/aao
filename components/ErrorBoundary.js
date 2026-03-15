"use client";

import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[AAO:ErrorBoundary]", error?.message || error, errorInfo?.componentStack?.slice(0, 300));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 200,
            padding: 32,
            textAlign: "center",
            color: "#b3b0d8",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <p style={{ fontSize: 16, marginBottom: 12 }}>
            문제가 발생했습니다. 새로고침 후 다시 시도해주세요.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              background: "#2a2a4a",
              color: "#b3b0d8",
              border: "1px solid #3a3a5a",
              borderRadius: 6,
              padding: "8px 20px",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
