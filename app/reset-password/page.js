'use client'

import {useEffect,useState} from 'react'
import {createClient} from '../../lib/supabase-browser'

export default function ResetPassword(){
  const s=createClient()
  const [lang,setLang]=useState('pl')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [recovery,setRecovery]=useState(false)
  const [msg,setMsg]=useState('')
  const [error,setError]=useState('')

  useEffect(()=>{
    setLang(localStorage.getItem('pt-lang')||'pl')

    let mounted=true

    s.auth.getSession().then(({data})=>{
      if(mounted && data.session) setRecovery(true)
    })

    const {data:listener}=s.auth.onAuthStateChange((event)=>{
      if(!mounted) return
      if(event==='PASSWORD_RECOVERY') setRecovery(true)
    })

    return ()=>{
      mounted=false
      listener.subscription.unsubscribe()
    }
  },[])

  const sendReset=async e=>{
    e.preventDefault()
    setMsg('')
    setError('')

    const {error}=await s.auth.resetPasswordForEmail(email,{
      redirectTo:window.location.origin+'/reset-password'
    })

    if(error){
      setError(error.message)
      return
    }

    setMsg(
      lang==='pl'
        ?'Jeśli konto z tym adresem istnieje, wysłaliśmy wiadomość z linkiem do ustawienia nowego hasła. Sprawdź również SPAM.'
        :'If an account with this email exists, we sent a message with a link to set a new password. Please also check SPAM.'
    )
  }

  const changePassword=async e=>{
    e.preventDefault()
    setMsg('')
    setError('')

    if(password.length<8){
      setError(lang==='pl'?'Hasło musi mieć co najmniej 8 znaków.':'Password must be at least 8 characters.')
      return
    }

    if(password!==confirm){
      setError(lang==='pl'?'Hasła nie są takie same.':'Passwords do not match.')
      return
    }

    const {error}=await s.auth.updateUser({password})

    if(error){
      setError(error.message)
      return
    }

    await s.auth.signOut()
    setMsg(lang==='pl'?'Hasło zostało zmienione. Możesz się teraz zalogować.':'Your password has been changed. You can now log in.')
    setTimeout(()=>{location.href='/login'},1200)
  }

  return (
    <Shell title={recovery?(lang==='pl'?'Ustaw nowe hasło':'Set a new password'):(lang==='pl'?'Odzyskaj hasło':'Reset password')}>
      {recovery ? (
        <form onSubmit={changePassword} className="panel">
          <label>{lang==='pl'?'Nowe hasło':'New password'}
            <input type="password" minLength="8" value={password} onChange={e=>setPassword(e.target.value)} required/>
          </label>
          <label>{lang==='pl'?'Powtórz hasło':'Confirm password'}
            <input type="password" minLength="8" value={confirm} onChange={e=>setConfirm(e.target.value)} required/>
          </label>
          <button className="primary btnfull">{lang==='pl'?'Zmień hasło':'Change password'}</button>
          {error&&<p className="error">{error}</p>}
          {msg&&<p className="notice">{msg}</p>}
        </form>
      ) : (
        <form onSubmit={sendReset} className="panel">
          <label>{lang==='pl'?'E-mail':'Email'}
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
          </label>
          <button className="primary btnfull">{lang==='pl'?'Wyślij link do zmiany hasła':'Send password reset link'}</button>
          {error&&<p className="error">{error}</p>}
          {msg&&<p className="notice">{msg}</p>}
          <p><a href="/login">{lang==='pl'?'← Wróć do logowania':'← Back to login'}</a></p>
        </form>
      )}
    </Shell>
  )
}

function Shell({title,children}){
  return <main className="auth"><a href="/"><img src="/images/logo.png" className="authlogo"/></a><h1>{title}</h1>{children}</main>
}
