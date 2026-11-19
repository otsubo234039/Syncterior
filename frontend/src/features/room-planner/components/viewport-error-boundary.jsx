import React from 'react';
import { CircleAlert } from 'lucide-react';

export class ViewportErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="viewport-error">
      <CircleAlert size={28} aria-hidden="true" />
      <p role="alert">3Dを表示できませんでした。</p>
      <button className="sharing-button" onClick={this.props.onContinue}>平面図で続ける</button>
    </div>;
  }
}
