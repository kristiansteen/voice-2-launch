import { Component } from 'react';

export default class BpmnErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('BpmnViewer crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-sm text-gray-500 p-6">
          <div className="text-red-500 font-medium">Diagram viewer crashed</div>
          <div className="text-xs text-gray-400 text-center max-w-xs break-words">
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-xs border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Reset viewer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
