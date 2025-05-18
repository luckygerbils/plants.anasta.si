import { useState, FormEvent, useEffect } from "react";
import { loggedIn, login } from "./util/auth";

interface LoginPageProps {
  searchParams?: URLSearchParams,
}

export function LoginPage({ searchParams }: LoginPageProps) {
  const [ username, setUsername ] = useState("");
  const [ password, setPassword ] = useState("");
  const [ { submitting, error }, setState ] = useState<{ submitting?: boolean, error?: Error }>({});

  function redirect() {
    // Avoid redirects outside the domain by taking just the pathname + search + hash
    const targetUrl = searchParams?.get("redirect") ? new URL(searchParams.get("redirect")!, location.href) : new URL("/", location.href);
    location.assign(targetUrl.pathname + targetUrl.search + targetUrl.hash);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    (async () => {
      setState({ submitting: true });
      try {
        await login(username, password);
        localStorage.setItem("previously-logged-in", "true");
      } catch (e) {
        setState({ error: e instanceof Error ? e : new Error(String(e)) });
      }
      redirect();
    })();
  }  

  useEffect(() => {
    if (loggedIn()) {
      redirect();
    }
  }, []);

  return (
    <form onSubmit={submit}>
      <label htmlFor="username">Username:</label>
      <input autoFocus id="username" value={username} onChange={e => setUsername(e.target.value)} disabled={submitting} />
      <label htmlFor="password">Password:</label>
      <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={submitting} />
      <button type="submit" disabled={submitting}>Login</button>
      {error && <div>Error: {error.message}</div>}
    </form>
  )
}
