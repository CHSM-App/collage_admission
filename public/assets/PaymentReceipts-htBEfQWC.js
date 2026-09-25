import{a as e,n as t,t as n}from"./jsx-runtime-C27Mmbu5.js";import{U as r,W as i,x as a}from"./index-DLZ8C76P.js";import{a as o}from"./Skeleton-CgO0mEqo.js";import{a as s,o as c,r as l,t as u}from"./paymentService-BVY5DoJF.js";var d=e(t(),1);function f(e,t,n={}){let{onPaid:i,refreshKey:o}=n,{redirectToPayU:l}=c(),f=r(),[p,m]=(0,d.useState)(null),[h,g]=(0,d.useState)(!0),[_,v]=(0,d.useState)(!1),[y,b]=(0,d.useState)(``),[x,S]=(0,d.useState)(``);function C(){g(!0),u(e).then(e=>m(e.data.data)).catch(()=>b(`Failed to load fee details.`)).finally(()=>g(!1))}(0,d.useEffect)(()=>{C()},[e,o]);async function w(t){if(!t||t<=0){b(`Invalid payment amount.`);return}b(``),S(``),v(!0);try{let{endpoint:n,fields:r}=(await s({application_id:e,payment_type:`college_fee`,amount:t})).data.data;l({endpoint:n,fields:r})}catch(e){let t=e?.response?.data?.message||`Could not initiate payment.`;b(t),f.error(t),v(!1)}}async function T(n,r={}){let{amount:o,note:s}=n;if(!o||o<=0)return b(`Enter a valid amount.`),!1;b(``),S(``),v(!0);try{let n=(await a(t,e,{amount:o,note:s?.trim()||void 0})).data.message;return f.success(n),S(n),C(),i?.(),r.onSuccess?.(n),!0}catch(e){let t=e?.response?.data?.message||`Failed to record payment.`;return b(t),f.error(t),!1}finally{v(!1)}}return{feeStatus:p,loading:h,paying:_,payError:y,paidMsg:x,fetchStatus:C,payOnline:w,payCash:T,setPayError:b,setPaidMsg:S}}var p=n(),m={application_fee:`Platform Fee`,college_fee:`College Fee`,college_fee_installment:`College Fee (Instalment)`,misc_fee:`Misc Fees`,exam_fee:`Exam Fees`},h={cash:`Cash`,payu:`Online (PayU)`,online:`Online`,upi:`UPI`,neft:`NEFT/RTGS`,dd:`Demand Draft`,cheque:`Cheque`};function g(e){if(!e)return null;try{return new Date(e.toString().replace(` `,`T`).split(`.`)[0])}catch{return null}}function _(e){let t=g(e);return t?t.toLocaleDateString(`en-IN`,{day:`2-digit`,month:`short`,year:`numeric`,timeZone:`Asia/Kolkata`}):`—`}function v(e){let t=g(e);return t?t.toLocaleTimeString(`en-IN`,{hour:`2-digit`,minute:`2-digit`,hour12:!0,timeZone:`Asia/Kolkata`}):``}function y({applicationId:e,onClose:t,hideTypes:n=[],showOrderId:r=!1}){let[i,a]=(0,d.useState)(null),[s,c]=(0,d.useState)(!0),[u,f]=(0,d.useState)(``),[g,y]=(0,d.useState)(null);if((0,d.useEffect)(()=>{l(e).then(e=>{let t=e.data.data;a(t)}).catch(()=>f(`Failed to load receipts.`)).finally(()=>c(!1))},[e]),s)return(0,p.jsx)(`div`,{className:`py-4 px-2`,children:(0,p.jsx)(o,{rows:4})});if(u)return(0,p.jsx)(`div`,{className:`py-6 text-center text-red-500 text-sm`,children:u});let x=(i?.payments||[]).filter(e=>!n.includes(e.payment_type));if(!x.length)return(0,p.jsx)(`div`,{className:`py-6 text-center text-slate-400 text-sm`,children:`No payment receipts found.`});let S=i?.fee_total==null?null:Number(i.fee_total),C=i?.college_paid==null?null:Number(i.college_paid);return S!=null&&C!=null&&Math.max(0,S-C),(0,p.jsxs)(`div`,{className:`space-y-2`,children:[t&&(0,p.jsxs)(`div`,{className:`flex items-center justify-between mb-1`,children:[(0,p.jsx)(`p`,{className:`text-sm font-bold text-slate-700`,children:`Payment Receipts`}),(0,p.jsx)(`button`,{onClick:t,className:`text-xs text-slate-400 hover:text-slate-600`,children:`✕ Close`})]}),x.map((e,t)=>{let n=e.status!==`success`,a=e.gateway?h[e.gateway]||e.gateway:null;return(0,p.jsxs)(`div`,{className:`rounded-lg border overflow-hidden ${n?`border-amber-200`:`border-slate-200`}`,children:[(0,p.jsxs)(`button`,{onClick:()=>!n&&y(g===e.id?null:e.id),className:`w-full flex items-center justify-between px-3 py-2.5 transition text-left ${n?`bg-amber-50 cursor-default`:`bg-white hover:bg-slate-50 cursor-pointer`}`,children:[(0,p.jsxs)(`div`,{className:`flex items-center gap-2.5`,children:[(0,p.jsx)(`div`,{className:`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${n?`bg-amber-100`:`bg-emerald-100`}`,children:(0,p.jsx)(`span`,{className:`text-xs font-bold ${n?`text-amber-700`:`text-emerald-700`}`,children:t+1})}),(0,p.jsxs)(`div`,{children:[(0,p.jsx)(`p`,{className:`text-sm font-semibold text-slate-900 leading-tight`,children:m[e.payment_type]||e.payment_type}),(0,p.jsxs)(`p`,{className:`text-xs text-slate-400`,children:[n?`Awaiting payment`:`${_(e.completed_at)} ${v(e.completed_at)}`,a&&!n&&(0,p.jsx)(`span`,{className:`ml-1.5 text-slate-300`,children:`·`}),a&&!n&&(0,p.jsx)(`span`,{className:`ml-1.5`,children:a})]})]})]}),(0,p.jsxs)(`div`,{className:`flex items-center gap-2 shrink-0`,children:[(0,p.jsxs)(`span`,{className:`text-sm font-bold text-slate-950`,children:[`₹`,Number(e.amount).toLocaleString(`en-IN`)]}),n?(0,p.jsx)(`span`,{className:`rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700`,children:`Pending`}):(0,p.jsx)(`span`,{className:`text-slate-300 text-xs`,children:g===e.id?`▲`:`▼`})]})]}),!n&&g===e.id&&(0,p.jsx)(b,{app:i.application,pmt:e,showOrderId:r,feeTotal:S,collegePaid:C})]},e.id)})]})}function b({app:e,pmt:t,showOrderId:n=!1,feeTotal:r=null,collegePaid:a=null}){let o=`RCP-${String(t.id).padStart(6,`0`)}`,s=m[t.payment_type]||t.payment_type,c=(e.app_full_name||e.student_name||``).trim(),l=t.gateway?h[t.gateway]||t.gateway:null,u=r!=null&&a!=null?Math.max(0,r-a):null,f=(0,d.useRef)(null),v=i()?.role===`college`;function y(n){let r=g(t.completed_at),i=r?`${String(r.getDate()).padStart(2,`0`)}/${String(r.getMonth()+1).padStart(2,`0`)}/${String(r.getFullYear()).slice(-2)}`:_(t.completed_at),a=`${{1:`FY`,2:`SY`,3:`TY`,4:`4Y`,5:`5Y`}[e.year_of_study]||``}${e.degree_course_code||``}${e.app_division?` - `+e.app_division:``}`,d=t.fee_heads||[],f=d.some(e=>e.paid!=null||e.amount!=null),p=d.length?f?d.map((e,t)=>`
          <tr>
            <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-size:11px;">${t+1}</td>
            <td style="border:1px solid #000;padding:3px 8px;font-size:11px;">${e.fees_head}</td>
            <td style="border:1px solid #000;padding:3px 8px;text-align:right;font-size:11px;">${Number(e.paid??e.amount).toFixed(2)}</td>
          </tr>`).join(``):`<tr>
            <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-size:11px;">1</td>
            <td style="border:1px solid #000;padding:3px 8px;font-size:11px;">${d.map(e=>e.fees_head).join(`, `)}</td>
            <td style="border:1px solid #000;padding:3px 8px;text-align:right;font-size:11px;">${Number(t.amount).toFixed(2)}</td>
          </tr>`:`<tr>
          <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-size:11px;">1</td>
          <td style="border:1px solid #000;padding:3px 8px;font-size:11px;">${s}</td>
          <td style="border:1px solid #000;padding:3px 8px;text-align:right;font-size:11px;">${Number(t.amount).toFixed(2)}</td>
        </tr>`,m=Number(t.amount).toFixed(2),h=u!=null&&u>=.01?`
        <div style="margin-top:6px;font-size:11px;">
          <span>Due : </span><strong>&#x20B9; ${u.toLocaleString(`en-IN`)}</strong>
        </div>`:``;return`
    <div style="width:48%;font-family:'Times New Roman',Times,serif;font-size:12px;color:#000;border:2px solid #000;padding:10px 12px;box-sizing:border-box;display:flex;flex-direction:column;">
      <div>
        <div style="text-align:right;font-size:10px;font-style:italic;margin-bottom:2px;">${n}</div>
        ${e.trust_name?`<div style="text-align:center;font-size:11px;">${e.trust_name}</div>`:``}
        <div style="text-align:center;font-size:13px;font-weight:bold;">${e.college_name||``}</div>
        ${e.college_address?`<div style="text-align:center;font-size:10.5px;">${e.college_address}${e.college_city?`, `+e.college_city:``}</div>`:``}
        ${e.college_affiliation?`<div style="text-align:center;font-size:10px;">(${e.college_affiliation})</div>`:``}

        <div style="margin-top:8px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Receipt No.- <strong>${o}</strong></span>
          <span>Date &nbsp;- &nbsp;${i}</span>
          <span>Class &nbsp;- &nbsp;${a}</span>
        </div>
        <div style="margin-top:4px;font-size:11px;display:flex;justify-content:space-between;">
          <span>Received from &nbsp;<strong>${c}</strong></span>
          ${l?`<span>Mode : <strong>${l}</strong></span>`:``}
        </div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;margin-top:8px;">
        <table style="width:100%;height:100%;border-collapse:collapse;border-bottom:1px solid #000;">
          <thead>
            <tr>
              <th style="border:1px solid #000;padding:3px 6px;font-size:11px;text-align:center;width:40px;">Sr. No.</th>
              <th style="border:1px solid #000;padding:3px 8px;font-size:11px;text-align:center;">Particular</th>
              <th style="border:1px solid #000;padding:3px 8px;font-size:11px;text-align:center;width:70px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${p}
            
          <tr style="height:100%;">
            <td colspan="3" style="border-left:1px solid #000;border-right:1px solid #000;border-top:none;border-bottom:none;"></td>
          </tr>
          </tbody>
        </table>
      </div>

      <div>
        <div style="margin-top:10px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Total : <strong>₹ ${m}</strong></span>
          <span style="font-style:italic;font-size:10px;">${S(Number(t.amount))} Only</span>
        </div>
        ${h}
        <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:11px;">
          <span>Student Signature</span>
          <span>Cashier / Accountant</span>
        </div>
      </div>
    </div>`}function b(){return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Fee Receipt — ${o}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Times New Roman',Times,serif;background:#fff;color:#000;padding:20px}
    @media print{
      body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .no-print{display:none!important}
      @page{size:A4 landscape;margin:10mm 12mm}
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:12px;">
    <button onclick="window.print()" style="padding:8px 24px;font-size:14px;cursor:pointer;background:#1e293b;color:#fff;border:none;border-radius:6px;">Print / Save PDF</button>
  </div>
  <!-- align-items:stretch: both copies always same height.
       min-height fills the landscape page; excess rows overflow to page 2. -->
  <div style="display:flex;gap:4%;align-items:stretch;min-height:calc(210mm - 20mm);${v?``:`justify-content:center;`}">
    ${v?y(`Office Copy`):``}
    ${y(`Student's Copy`)}
  </div>
</body>
</html>`}function C(){let e=window.open(``,`_blank`,`width=860,height=900`);e.document.write(b()),e.document.close(),e.focus(),setTimeout(()=>{e.print(),e.close()},600)}let w=g(t.completed_at),T=w?`${String(w.getDate()).padStart(2,`0`)}/${String(w.getMonth()+1).padStart(2,`0`)}/${String(w.getFullYear()).slice(-2)}`:_(t.completed_at),E=`${{1:`FY`,2:`SY`,3:`TY`,4:`4Y`,5:`5Y`}[e.year_of_study]||``}${e.degree_course_code||``}${e.app_division?` - `+e.app_division:``}`,D=t.fee_heads||[],O=D.some(e=>e.paid!=null||e.amount!=null),k=D.length?O?D:[{fees_head:D.map(e=>e.fees_head).join(`, `),paid:t.amount,amount:t.amount}]:[{fees_head:s,paid:t.amount,amount:t.amount}];return(0,p.jsxs)(`div`,{className:`border-t border-slate-100`,children:[(0,p.jsx)(`div`,{className:`flex gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 justify-end`,children:(0,p.jsxs)(`button`,{onClick:C,className:`flex items-center gap-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-slate-700 transition`,children:[(0,p.jsx)(`svg`,{className:`w-3 h-3`,fill:`none`,viewBox:`0 0 24 24`,stroke:`currentColor`,strokeWidth:`2`,children:(0,p.jsx)(`path`,{strokeLinecap:`round`,strokeLinejoin:`round`,d:`M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z`})}),`Print / Save PDF`]})}),(0,p.jsx)(`div`,{ref:f,className:`bg-white p-4`,style:{fontFamily:`'Times New Roman', Times, serif`,color:`#000`},children:(0,p.jsx)(x,{copyLabel:v?`Office Copy`:`Student's Copy`,app:e,receiptNo:o,shortDate:T,classLabel:E,studentName:c,displayRows:k,fillerCount:0,pmt:t,modeLabel:l,dueAmt:u})})]})}function x({copyLabel:e,app:t,receiptNo:n,shortDate:r,classLabel:i,studentName:a,displayRows:o,fillerCount:s,pmt:c,modeLabel:l,dueAmt:u}){let d=`border border-black px-2 py-1 text-xs`;return(0,p.jsxs)(`div`,{className:`border border-black p-3 text-xs`,style:{fontFamily:`'Times New Roman', Times, serif`},children:[(0,p.jsx)(`div`,{className:`text-right italic text-xs mb-1`,children:e}),t.trust_name&&(0,p.jsx)(`div`,{className:`text-center text-xs`,children:t.trust_name}),(0,p.jsx)(`div`,{className:`text-center font-bold text-sm`,children:t.college_name}),(t.college_address||t.college_city)&&(0,p.jsx)(`div`,{className:`text-center text-xs`,children:[t.college_address,t.college_city].filter(Boolean).join(`, `)}),t.college_affiliation&&(0,p.jsxs)(`div`,{className:`text-center text-xs`,children:[`(`,t.college_affiliation,`)`]}),(0,p.jsxs)(`div`,{className:`flex justify-between mt-2 text-xs`,children:[(0,p.jsxs)(`span`,{children:[`Receipt No.- `,(0,p.jsx)(`strong`,{children:n})]}),(0,p.jsxs)(`span`,{children:[`Date \xA0- \xA0`,r]}),i&&(0,p.jsxs)(`span`,{children:[`Class \xA0- \xA0`,i]})]}),(0,p.jsxs)(`div`,{className:`flex justify-between mt-1 text-xs`,children:[(0,p.jsxs)(`span`,{children:[`Received from \xA0`,(0,p.jsx)(`strong`,{children:a})]}),l&&(0,p.jsxs)(`span`,{children:[`Mode : `,(0,p.jsx)(`strong`,{children:l})]})]}),(0,p.jsxs)(`table`,{className:`w-full border-collapse mt-2 border-b border-black`,style:{height:`100%`},children:[(0,p.jsx)(`thead`,{children:(0,p.jsxs)(`tr`,{children:[(0,p.jsx)(`th`,{className:`${d} text-center w-10`,children:`Sr. No.`}),(0,p.jsx)(`th`,{className:`${d} text-center`,children:`Particular`}),(0,p.jsx)(`th`,{className:`${d} text-center w-20`,children:`Amount`})]})}),(0,p.jsxs)(`tbody`,{children:[o.map((e,t)=>(0,p.jsxs)(`tr`,{children:[(0,p.jsx)(`td`,{className:`${d} text-center`,children:t+1}),(0,p.jsx)(`td`,{className:d,children:e.fees_head}),(0,p.jsx)(`td`,{className:`${d} text-right`,children:Number(e.paid??e.amount).toFixed(2)})]},t)),(0,p.jsx)(`tr`,{style:{height:`100%`},children:(0,p.jsx)(`td`,{colSpan:3,className:`border-x border-black border-t-0 border-b-0`})})]})]}),(0,p.jsxs)(`div`,{className:`flex justify-between mt-2 text-xs`,children:[(0,p.jsxs)(`span`,{children:[`Total : `,(0,p.jsxs)(`strong`,{children:[`₹ `,Number(c.amount).toFixed(2)]})]}),(0,p.jsxs)(`span`,{className:`italic`,children:[S(Number(c.amount)),` Only`]})]}),u!=null&&u>=.01&&(0,p.jsxs)(`div`,{className:`mt-1 text-xs`,children:[(0,p.jsx)(`span`,{children:`Due : `}),(0,p.jsxs)(`strong`,{children:[`₹ `,u.toLocaleString(`en-IN`)]})]}),(0,p.jsxs)(`div`,{className:`flex justify-between mt-5 text-xs`,children:[(0,p.jsx)(`span`,{children:`Student Signature`}),(0,p.jsx)(`span`,{children:`Cashier / Accountant`})]})]})}function S(e){if(!e||isNaN(e))return`Zero Rupees`;let t=[``,`One`,`Two`,`Three`,`Four`,`Five`,`Six`,`Seven`,`Eight`,`Nine`,`Ten`,`Eleven`,`Twelve`,`Thirteen`,`Fourteen`,`Fifteen`,`Sixteen`,`Seventeen`,`Eighteen`,`Nineteen`],n=[``,``,`Twenty`,`Thirty`,`Forty`,`Fifty`,`Sixty`,`Seventy`,`Eighty`,`Ninety`];function r(e){return e===0?``:e<20?t[e]+` `:e<100?n[Math.floor(e/10)]+(e%10?` `+t[e%10]:``)+` `:e<1e3?t[Math.floor(e/100)]+` Hundred `+r(e%100):e<1e5?r(Math.floor(e/1e3))+`Thousand `+r(e%1e3):e<1e7?r(Math.floor(e/1e5))+`Lakh `+r(e%1e5):r(Math.floor(e/1e7))+`Crore `+r(e%1e7)}let i=Math.floor(e),a=Math.round((e-i)*100),o=r(i).trim()+` Rupees`;return a>0&&(o+=` and `+r(a).trim()+` Paise`),o}export{f as n,y as t};