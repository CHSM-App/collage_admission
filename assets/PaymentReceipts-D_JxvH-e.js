import{_ as e,h as t,n,r}from"./Button-Cd2fIBWT.js";import{i,n as a,p as o,r as s,t as c}from"./index-CHi-HfcJ.js";import{a as l}from"./Skeleton-BKv5Vxax.js";import{t as u}from"./useRazorpay-C664MZDu.js";var d=e(t(),1),f=(e,t)=>r.get(`college-admin/${e}/applications?${t}`),p=(e,t)=>r.get(`college-admin/${e}/applications/${t}`),m=(e,t,n,i)=>r.post(`college-admin/${e}/applications/${t}/${n}`,i),h=(e,t,n)=>r.post(`college-admin/${e}/applications/${t}/confirm`,n),g=(e,t,n)=>r.post(`college-admin/${e}/applications/${t}/set-fee`,n),_=(e,t,n)=>r.post(`college-admin/${e}/applications/${t}/record-cash-payment`,n),v=(e,t)=>{let n=t===void 0?``:`?active=${t}`;return r.get(`college-admin/${e}/admission-periods${n}`)},y=(e,t)=>r.post(`college-admin/${e}/admission-periods`,t),b=(e,t,n)=>r.put(`college-admin/${e}/admission-periods/${t}`,n),x=(e,t)=>r.get(`college-admin/${e}/fee-receipts?${t}`),S=(e,t)=>r.post(`college-admin/${e}/roll-numbers/generate`,t),C=(e,t)=>r.get(`college-admin/${e}/students/search?q=${encodeURIComponent(t)}`),w=(e,t)=>r.get(`college-admin/${e}/applications/export?${t}`);function T(e,t,n=`asc`,r={}){let{searchFields:i=[],numericCols:a=[]}=r,[o,s]=(0,d.useState)(t),[c,l]=(0,d.useState)(n),[u,f]=(0,d.useState)(``);function p(e){o===e?l(e=>e===`asc`?`desc`:`asc`):(s(e),l(`asc`))}return{sorted:(0,d.useMemo)(()=>{let t=e;if(i.length>0&&u.trim()){let e=u.trim().toLowerCase();t=t.filter(t=>i.some(n=>String(t[n]||``).toLowerCase().includes(e)))}return[...t].sort((e,t)=>{let n=e[o],r=t[o];n??=``,r??=``,a.includes(o)&&(n=Number(n),r=Number(r));let i=typeof n==`number`&&typeof r==`number`?n-r:String(n).localeCompare(String(r));return c===`asc`?i:-i})},[e,o,c,u]),query:u,setQuery:f,sortCol:o,sortDir:c,toggleSort:p}}function E(e,t,n={}){let{onPaid:r}=n,{openCheckout:s,scriptError:l}=u(),f=o(),[p,m]=(0,d.useState)(null),[h,g]=(0,d.useState)(!0),[v,y]=(0,d.useState)(!1),[b,x]=(0,d.useState)(``),[S,C]=(0,d.useState)(``);function w(){g(!0),a(e).then(e=>m(e.data.data)).catch(()=>x(`Failed to load fee details.`)).finally(()=>g(!1))}(0,d.useEffect)(()=>{w()},[e]);async function T(t,n={}){if(!t||t<=0){x(`Invalid payment amount.`);return}x(``),C(``),y(!0);try{let a=(await c({application_id:e,payment_type:`college_fee`,amount:t})).data.data;y(!1),s({orderData:a,onSuccess:async t=>{y(!0);try{let a=await i({application_id:e,payment_type:`college_fee`,razorpay_order_id:t.razorpay_order_id,razorpay_payment_id:t.razorpay_payment_id,razorpay_signature:t.razorpay_signature}),o=a.data.message;f.success(o),C(o),w(),r?.(),n.onSuccess?.(o,a.data.data)}catch(e){let t=e?.response?.data?.message||`Payment verification failed.`;x(t),f.error(t)}finally{y(!1)}},onFailure:e=>{y(!1),e.message!==`Payment cancelled by user.`&&(x(e.message),f.error(e.message))}})}catch(e){let t=e?.response?.data?.message||`Could not initiate payment.`;x(t),f.error(t),y(!1)}}async function E(n,i={}){let{amount:a,note:o}=n;if(!a||a<=0)return x(`Enter a valid amount.`),!1;x(``),C(``),y(!0);try{let n=(await _(t,e,{amount:a,note:o?.trim()||void 0})).data.message;return f.success(n),C(n),w(),r?.(),i.onSuccess?.(n),!0}catch(e){let t=e?.response?.data?.message||`Failed to record payment.`;return x(t),f.error(t),!1}finally{y(!1)}}return{feeStatus:p,loading:h,paying:v,payError:b,paidMsg:S,scriptError:l,fetchStatus:w,payOnline:T,payCash:E,setPayError:x,setPaidMsg:C}}var D=n(),O={1:`First Year (FY)`,2:`Second Year (SY)`,3:`Third Year (TY)`,4:`Fourth Year (4Y)`,5:`Fifth Year (5Y)`},k={application_fee:`Platform Fee`,college_fee:`College Fee`};function A(e){if(!e)return null;try{return new Date(e.toString().replace(` `,`T`).split(`.`)[0])}catch{return null}}function j(e){let t=A(e);return t?t.toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`,timeZone:`Asia/Kolkata`}):`—`}function M(e){let t=A(e);return t?t.toLocaleTimeString(`en-IN`,{hour:`2-digit`,minute:`2-digit`,hour12:!0,timeZone:`Asia/Kolkata`}):``}function N({applicationId:e,onClose:t,hideTypes:n=[],showOrderId:r=!1}){let[i,a]=(0,d.useState)(null),[o,c]=(0,d.useState)(!0),[u,f]=(0,d.useState)(``),[p,m]=(0,d.useState)(null);if((0,d.useEffect)(()=>{s(e).then(e=>{let t=e.data.data;a(t);let r=(t.payments||[]).filter(e=>!n.includes(e.payment_type));r.length&&m(r[r.length-1].id)}).catch(()=>f(`Failed to load receipts.`)).finally(()=>c(!1))},[e]),o)return(0,D.jsx)(`div`,{className:`py-4 px-2`,children:(0,D.jsx)(l,{rows:4})});if(u)return(0,D.jsx)(`div`,{className:`py-6 text-center text-red-500 text-sm`,children:u});let h=(i?.payments||[]).filter(e=>!n.includes(e.payment_type));return h.length?(0,D.jsxs)(`div`,{className:`space-y-2`,children:[t&&(0,D.jsxs)(`div`,{className:`flex items-center justify-between mb-1`,children:[(0,D.jsx)(`p`,{className:`text-sm font-bold text-slate-700`,children:`Payment Receipts`}),(0,D.jsx)(`button`,{onClick:t,className:`text-xs text-slate-400 hover:text-slate-600`,children:`✕ Close`})]}),h.map((e,t)=>(0,D.jsxs)(`div`,{className:`rounded-lg border border-slate-200 overflow-hidden`,children:[(0,D.jsxs)(`button`,{onClick:()=>m(p===e.id?null:e.id),className:`w-full flex items-center justify-between px-3 py-2.5 bg-white hover:bg-slate-50 transition text-left`,children:[(0,D.jsxs)(`div`,{className:`flex items-center gap-2.5`,children:[(0,D.jsx)(`div`,{className:`h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0`,children:(0,D.jsx)(`span`,{className:`text-emerald-700 text-xs font-bold`,children:t+1})}),(0,D.jsxs)(`div`,{children:[(0,D.jsx)(`p`,{className:`text-sm font-semibold text-slate-900 leading-tight`,children:k[e.payment_type]||e.payment_type}),(0,D.jsxs)(`p`,{className:`text-xs text-slate-400`,children:[j(e.completed_at),` `,M(e.completed_at)]})]})]}),(0,D.jsxs)(`div`,{className:`flex items-center gap-2 shrink-0`,children:[(0,D.jsxs)(`span`,{className:`text-sm font-bold text-slate-950`,children:[`₹`,Number(e.amount).toLocaleString(`en-IN`)]}),(0,D.jsx)(`span`,{className:`text-slate-300 text-xs`,children:p===e.id?`▲`:`▼`})]})]}),p===e.id&&(0,D.jsx)(P,{app:i.application,pmt:e,showOrderId:r})]},e.id))]}):(0,D.jsx)(`div`,{className:`py-6 text-center text-slate-400 text-sm`,children:`No payment receipts found.`})}function P({app:e,pmt:t,showOrderId:n=!1}){let r=`RCP-${String(t.id).padStart(6,`0`)}`,i=k[t.payment_type]||t.payment_type,a=(e.app_full_name||e.student_name||``).trim(),o=(0,d.useRef)(null);function s(){let n=[e.college_address,e.college_city].filter(Boolean).join(`, `),o=[e.college_phone?`Ph: ${e.college_phone}`:``,e.college_email?`${e.college_email}`:``].filter(Boolean).join(`  |  `),s=F(Number(t.amount)),c=new Date().toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`});function l(e,t,n){return`
        <tr>
          <td style="padding:7px 12px;font-size:11.5px;color:#64748b;font-weight:500;width:38%;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${e}</td>
          <td style="padding:7px 12px;font-size:11.5px;color:#1e293b;font-weight:600;border-bottom:1px solid #f1f5f9;word-break:break-all;${n?`font-family:monospace;font-size:10.5px;`:``}">${t||`—`}</td>
        </tr>`}return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Payment Receipt — ${r}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#f1f5f9;color:#1e293b;padding:32px 24px}
    @media print{
      body{background:#fff;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .no-print{display:none}
      @page{size:A4;margin:14mm 16mm}
    }
  </style>
</head>
<body>

<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

  <!-- ═══ TOP ACCENT BAR ═══ -->
  <div style="height:5px;background:linear-gradient(90deg,#0f172a 0%,#1d4ed8 50%,#0ea5e9 100%);"></div>

  <!-- ═══ HEADER ═══ -->
  <div style="padding:24px 28px 20px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e2e8f0;">
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Official Payment Receipt</div>
      <div style="font-size:18px;font-weight:800;color:#0f172a;line-height:1.2;">${e.college_name||`—`}</div>
      ${n?`<div style="font-size:11px;color:#64748b;margin-top:3px;">${n}</div>`:``}
      ${o?`<div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${o}</div>`:``}
    </div>
    <div style="text-align:right;flex-shrink:0;margin-left:20px;">
      <div style="display:inline-block;background:#dcfce7;border:1.5px solid #86efac;border-radius:6px;padding:6px 14px;margin-bottom:8px;">
        <div style="font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#15803d;">Payment Status</div>
        <div style="font-size:14px;font-weight:800;color:#16a34a;margin-top:1px;">&#10003; PAID</div>
      </div>
      <div style="font-size:10px;color:#94a3b8;font-family:monospace;font-weight:600;">${r}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Printed: ${c}</div>
    </div>
  </div>

  <!-- ═══ AMOUNT HERO BAND ═══ -->
  <div style="background:#0f172a;padding:20px 28px;display:flex;justify-content:space-between;align-items:center;">
    <div>
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Amount Paid</div>
      <div style="font-size:32px;font-weight:900;color:#4ade80;letter-spacing:-0.5px;">&#8377;${Number(t.amount).toLocaleString(`en-IN`)}</div>
      <div style="font-size:10.5px;color:#94a3b8;margin-top:4px;font-style:italic;">${s} Only</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Payment For</div>
      <div style="font-size:13px;font-weight:700;color:#e2e8f0;">${i}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:6px;">${j(t.completed_at)}&nbsp;&nbsp;${M(t.completed_at)}</div>
    </div>
  </div>

  <!-- ═══ BODY ═══ -->
  <div style="padding:0 28px 24px;">

    <!-- Student Details -->
    <div style="margin-top:22px;">
      <div style="font-size:8.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #0f172a;">Student &amp; Application Details</div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${l(`Student Name`,a)}
          ${l(`Mobile`,e.app_mobile||e.student_phone)}
          ${l(`College`,e.college_name)}
          ${l(`Course`,e.course_name)}
          ${l(`Year of Study`,O[e.year_of_study])}
          ${l(`Academic Year`,e.academic_year)}
          ${e.registration_number?l(`Registration No.`,e.registration_number,!0):``}
        </tbody>
      </table>
    </div>

    <!-- Payment Details -->
    <div style="margin-top:20px;">
      <div style="font-size:8.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #0f172a;">Transaction Details</div>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${l(`Receipt Number`,r,!0)}
          ${l(`Payment Type`,i)}
          ${l(`Amount Paid`,`&#8377;`+Number(t.amount).toLocaleString(`en-IN`))}
          ${l(`Payment Status`,`Paid`)}
          ${l(`Payment Date`,j(t.completed_at)+`  `+M(t.completed_at))}
          ${t.razorpay_payment_id?l(`Transaction ID`,t.razorpay_payment_id,!0):``}
        </tbody>
      </table>
    </div>

    <!-- Stamp + Declaration row -->
    <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;">
      <div style="flex:1;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:12px 16px;">
        <p style="font-size:10px;color:#64748b;line-height:1.6;">
          This is a computer-generated receipt and does not require a physical signature.
          Please retain this for your records. For queries, contact the college office.
        </p>
      </div>
      <div style="flex-shrink:0;text-align:center;">
        <div style="width:90px;height:90px;border-radius:50%;border:3px solid #16a34a;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f0fdf4;">
          <div style="font-size:20px;color:#16a34a;line-height:1;">&#10003;</div>
          <div style="font-size:8px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#16a34a;margin-top:2px;">VERIFIED</div>
          <div style="font-size:7px;color:#86efac;margin-top:1px;">e-Verified</div>
        </div>
      </div>
    </div>

  </div>

  <!-- ═══ FOOTER BAR ═══ -->
  <div style="height:3px;background:linear-gradient(90deg,#0f172a 0%,#1d4ed8 50%,#0ea5e9 100%);"></div>
  <div style="background:#f8fafc;padding:10px 28px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:9.5px;color:#94a3b8;">College Admission Portal</span>
    <span style="font-size:9.5px;color:#94a3b8;font-family:monospace;">${r}</span>
  </div>

</div>
</body>
</html>`}function c(){let e=window.open(``,`_blank`,`width=860,height=900`);e.document.write(s()),e.document.close(),e.focus(),setTimeout(()=>{e.print(),e.close()},600)}return(0,D.jsxs)(`div`,{className:`border-t border-slate-100`,children:[(0,D.jsx)(`div`,{className:`flex gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 justify-end`,children:(0,D.jsxs)(`button`,{onClick:c,className:`flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-slate-700 transition`,children:[(0,D.jsx)(`svg`,{className:`w-3 h-3`,fill:`none`,viewBox:`0 0 24 24`,stroke:`currentColor`,strokeWidth:`2`,children:(0,D.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z`})}),`Print / Save PDF`]})}),(0,D.jsxs)(`div`,{ref:o,className:`bg-white overflow-hidden`,children:[(0,D.jsx)(`div`,{className:`h-1`,style:{background:`linear-gradient(90deg,#0f172a 0%,#1d4ed8 50%,#0ea5e9 100%)`}}),(0,D.jsxs)(`div`,{className:`flex items-start justify-between px-5 py-4 border-b border-slate-100`,children:[(0,D.jsxs)(`div`,{children:[(0,D.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-widest text-slate-400 mb-0.5`,children:`Official Payment Receipt`}),(0,D.jsx)(`p`,{className:`text-base font-extrabold text-slate-900`,children:e.college_name}),(e.college_address||e.college_city)&&(0,D.jsx)(`p`,{className:`text-xs text-slate-500 mt-0.5`,children:[e.college_address,e.college_city].filter(Boolean).join(`, `)})]}),(0,D.jsxs)(`div`,{className:`text-right shrink-0 ml-4`,children:[(0,D.jsx)(`div`,{className:`inline-block border border-emerald-300 bg-emerald-50 rounded-md px-3 py-1.5 mb-1.5`,children:(0,D.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-widest text-emerald-600`,children:`✓ PAID`})}),(0,D.jsx)(`p`,{className:`text-xs font-mono text-slate-400`,children:r})]})]}),(0,D.jsxs)(`div`,{className:`flex items-center justify-between bg-slate-900 px-5 py-4`,children:[(0,D.jsxs)(`div`,{children:[(0,D.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5`,children:`Amount Paid`}),(0,D.jsxs)(`p`,{className:`text-3xl font-black text-emerald-400`,children:[`₹`,Number(t.amount).toLocaleString(`en-IN`)]}),(0,D.jsxs)(`p`,{className:`text-xs text-slate-500 italic mt-1`,children:[F(Number(t.amount)),` Only`]})]}),(0,D.jsxs)(`div`,{className:`text-right`,children:[(0,D.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-widest text-slate-500 mb-0.5`,children:`Payment For`}),(0,D.jsx)(`p`,{className:`text-sm font-bold text-slate-200`,children:i}),(0,D.jsxs)(`p`,{className:`text-xs text-slate-500 mt-1`,children:[j(t.completed_at),` \xA0 `,M(t.completed_at)]})]})]}),(0,D.jsxs)(`div`,{className:`px-5 py-4 space-y-5`,children:[(0,D.jsxs)(`div`,{children:[(0,D.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-widest text-slate-400 border-b-2 border-slate-900 pb-1 mb-2`,children:`Student & Application Details`}),(0,D.jsx)(`table`,{className:`w-full text-sm`,children:(0,D.jsx)(`tbody`,{children:[[`Student Name`,a],[`Mobile`,e.app_mobile||e.student_phone],[`College`,e.college_name],[`Course`,e.course_name],[`Year of Study`,O[e.year_of_study]],[`Academic Year`,e.academic_year],...e.registration_number?[[`Registration No.`,e.registration_number]]:[]].map(([e,t])=>(0,D.jsxs)(`tr`,{className:`border-b border-slate-50`,children:[(0,D.jsx)(`td`,{className:`py-1.5 pr-4 text-slate-500 font-medium w-40 whitespace-nowrap`,children:e}),(0,D.jsx)(`td`,{className:`py-1.5 text-slate-800 font-semibold`,children:t||`—`})]},e))})})]}),(0,D.jsxs)(`div`,{children:[(0,D.jsx)(`p`,{className:`text-xs font-bold uppercase tracking-widest text-slate-400 border-b-2 border-slate-900 pb-1 mb-2`,children:`Transaction Details`}),(0,D.jsx)(`table`,{className:`w-full text-sm`,children:(0,D.jsx)(`tbody`,{children:[[`Receipt Number`,r,!0],[`Payment Type`,i,!1],[`Amount Paid`,`₹${Number(t.amount).toLocaleString(`en-IN`)}`,!1],[`Payment Status`,`Paid`,!1],[`Payment Date`,`${j(t.completed_at)}  ${M(t.completed_at)}`,!1],...t.razorpay_payment_id?[[`Transaction ID`,t.razorpay_payment_id,!0]]:[],...n&&t.razorpay_order_id?[[`Order ID`,t.razorpay_order_id,!0]]:[]].map(([e,t,n])=>(0,D.jsxs)(`tr`,{className:`border-b border-slate-50`,children:[(0,D.jsx)(`td`,{className:`py-1.5 pr-4 text-slate-500 font-medium w-40 whitespace-nowrap`,children:e}),(0,D.jsx)(`td`,{className:`py-1.5 text-slate-800 font-semibold break-all ${n?`font-mono text-xs`:``}`,children:t||`—`})]},e))})})]}),(0,D.jsxs)(`div`,{className:`flex items-end justify-between gap-4 pt-1`,children:[(0,D.jsx)(`div`,{className:`flex-1 bg-slate-50 border border-dashed border-slate-200 rounded-lg px-4 py-3`,children:(0,D.jsx)(`p`,{className:`text-xs text-slate-500 leading-relaxed`,children:`This is a computer-generated receipt and does not require a physical signature. Please retain this for your records.`})}),(0,D.jsxs)(`div`,{className:`shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-emerald-500 bg-emerald-50`,children:[(0,D.jsx)(`span`,{className:`text-lg text-emerald-600`,children:`✓`}),(0,D.jsx)(`span`,{className:`text-xs font-black uppercase tracking-wide text-emerald-700 leading-tight text-center`,children:`Verified`})]})]})]}),(0,D.jsx)(`div`,{className:`h-0.5`,style:{background:`linear-gradient(90deg,#0f172a 0%,#1d4ed8 50%,#0ea5e9 100%)`}}),(0,D.jsxs)(`div`,{className:`flex items-center justify-between bg-slate-50 px-5 py-2`,children:[(0,D.jsx)(`p`,{className:`text-xs text-slate-400`,children:`College Admission Portal`}),(0,D.jsx)(`p`,{className:`text-xs font-mono text-slate-400`,children:r})]})]})]})}function F(e){if(!e||isNaN(e))return`Zero Rupees`;let t=[``,`One`,`Two`,`Three`,`Four`,`Five`,`Six`,`Seven`,`Eight`,`Nine`,`Ten`,`Eleven`,`Twelve`,`Thirteen`,`Fourteen`,`Fifteen`,`Sixteen`,`Seventeen`,`Eighteen`,`Nineteen`],n=[``,``,`Twenty`,`Thirty`,`Forty`,`Fifty`,`Sixty`,`Seventy`,`Eighty`,`Ninety`];function r(e){return e===0?``:e<20?t[e]+` `:e<100?n[Math.floor(e/10)]+(e%10?` `+t[e%10]:``)+` `:e<1e3?t[Math.floor(e/100)]+` Hundred `+r(e%100):e<1e5?r(Math.floor(e/1e3))+`Thousand `+r(e%1e3):e<1e7?r(Math.floor(e/1e5))+`Lakh `+r(e%1e5):r(Math.floor(e/1e7))+`Crore `+r(e%1e7)}let i=Math.floor(e),a=Math.round((e-i)*100),o=r(i).trim()+` Rupees`;return a>0&&(o+=` and `+r(a).trim()+` Paise`),o}export{y as a,p as c,x as d,m as f,b as h,h as i,f as l,g as m,E as n,w as o,C as p,T as r,S as s,N as t,v as u};