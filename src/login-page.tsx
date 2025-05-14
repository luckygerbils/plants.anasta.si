import { useState, FormEvent, PropsWithChildren } from "react";
import { loggedIn, login } from "./auth";

interface LoginPageProps {
  onLogin: () => void,
}

export function LoginGateway({ children }: PropsWithChildren<object>) {
  const [ isLoggedIn, setIsLoggedIn ] = useState(() => loggedIn());
  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)}/>
  } else {
    return <>{children}</>
  }
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [ username, setUsername ] = useState("");
  const [ password, setPassword ] = useState("");
  const [ { submitting, error }, setState ] = useState<{ submitting?: boolean, error?: Error }>({});

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    (async () => {
      setState({ submitting: true });

      try {
        login(username, password);
      } catch (e) {
        setState({ error: e instanceof Error ? e : new Error(String(e)) });
      }
      onLogin();
      setState({ submitting: false });
    })();
  }

  return (
    <form onSubmit={submit}>
      <label>Username: <input value={username} onChange={e => setUsername(e.target.value)} disabled={submitting} /></label>
      <label>Password: <input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={submitting} /></label>
      <button type="submit" disabled={submitting}>Login</button>
      {error && <div>Error: {error.message}</div>}
    </form>
  )
}
