export default function CharacterCertificate({ collegeId, readOnly }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">College portal</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Character Certificate</h1>
        <p className="mt-1 text-slate-600">Issue a character certificate for an outgoing student.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white px-5 py-6">
        <p className="text-sm text-slate-500">
          Certificate generation is being configured for this college. Once enabled, you'll be able to look up a student
          by registration number and issue a printable character certificate from this page.
        </p>
      </div>
    </section>
  )
}
