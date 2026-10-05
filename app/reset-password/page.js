'use client'

import {useEffect,useState} from 'react'
import {createClient} from '../../lib/supabase-browser'

export default function ResetPassword(){
  const s=createClient()
  const [lang,setLang]=useState('pl')
  const [email,setEmail]=useState('')
  const [token,setToken]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [recovery,setRecovery]=useState(false)
  const [step,setStep]=useState('request')
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

    setStep('verify')
    setMsg(
      lang==='pl'
        ?'Wysłaliśmy kod na Twój e-mail. Sprawdź wiadomość i wpisz kod poniżej.'
        :'We sent a verification code to your email. Check your message and enter the code below.'
    )
  }

  const verifyCode=async e=>{
    e.preventDefault()
    setMsg('')
    setError('')

    const cleanToken=token.replace(/\s/g,'')
    if(!/^\d{6}$/.test(cleanToken)){
      setError(lang==='pl'?'Wpisz 6-cyfrowy kod.':'Enter the 6-digit code.')
      return
    }

    const {error}=await s.auth.verifyOtp({
      email,
      token:cleanToken,
      type:'recovery'
    })

    if(error){
      setError(error.message)
      return
    }

    setRecovery(true)
    setMsg(lang==='pl'?'Kod został potwierdzony. Możesz teraz ustawić nowe hasło.':'Code verified. You can now set a new password.')
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
      ) : step==='verify' ? (
        <form onSubmit={verifyCode} className="panel">
          <label>{lang==='pl'?'Kod z e-maila':'Code from email'}
            <input inputMode="numeric" autoComplete="one-time-code" value={token} onChange={e=>setToken(e.target.value)} placeholder="123456" maxLength="6" required/>
          </label>
          <button className="primary btnfull">{lang==='pl'?'Potwierdź kod':'Verify code'}</button>
          {error&&<p className="error">{error}</p>}
          {msg&&<p className="notice">{msg}</p>}
          <p><a href="/reset-password">{lang==='pl'?'Wyślij kod ponownie':'Send a new code'}</a></p>
        </form>
      ) : (
        <form onSubmit={sendReset} className="panel">
          <label>{lang==='pl'?'E-mail':'Email'}
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
          </label>
          <button className="primary btnfull">{lang==='pl'?'Wyślij kod do zmiany hasła':'Send password reset code'}</button>
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