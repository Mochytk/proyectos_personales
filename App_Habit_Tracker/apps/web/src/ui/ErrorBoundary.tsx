import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
  attempt: number;
}

// Contains a crash to one section with a clear message (RNF-4). "Reintentar" remounts
// the section through a new key, so its state starts fresh.
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  private readonly retry = () => {
    this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
  };

  override render() {
    if (this.state.failed) {
      return (
        <div className="async-problem" role="alert">
          <p>Algo falló en esta sección.</p>
          <button type="button" className="button" onClick={this.retry}>
            Reintentar
          </button>
        </div>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
