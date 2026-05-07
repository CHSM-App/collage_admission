export default function BonafideCertificate({ collegeId, readOnly }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Bonafide Certificate</h1>
        <p className="mt-1 text-slate-600">Issue a bonafide certificate confirming a student's enrolment with the college.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-6">
        <p className="text-sm text-slate-500">
          Certificate generation is being configured for this college. Once enabled, you'll be able to look up a student
          by registration number and issue a printable bonafide certificate from this page.
        </p>
      </div>
    </section>
  )
}
