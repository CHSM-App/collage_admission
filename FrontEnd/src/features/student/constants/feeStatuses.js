// Application statuses that carry a fee obligation. Anything earlier — a draft
// above all — has nothing to pay yet, so it must not surface on the fee pages.
export const FEE_STATUSES = ['confirmed', 'fees_paid', 'roll_assigned', 'enrolled']
