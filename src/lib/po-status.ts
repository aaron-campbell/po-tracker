export function calculatePOStatus(totalValue: number, invoicedAmount: number, currentStatus: string): string {
  if (currentStatus === "Closed") return "Closed";
  if (currentStatus === "Revised") return "Revised";

  if (totalValue === 0) return "Open";

  const consumedPercent = (invoicedAmount / totalValue) * 100;

  if (consumedPercent > 100) return "Exceeded";
  if (consumedPercent >= 90) return "90% Used";
  return "Open";
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Open": return "bg-green-100 text-green-800";
    case "Revised": return "bg-blue-100 text-blue-800";
    case "90% Used": return "bg-yellow-100 text-yellow-800";
    case "Exceeded": return "bg-red-100 text-red-800";
    case "Closed": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case "Sent": return "bg-blue-100 text-blue-800";
    case "Received": return "bg-yellow-100 text-yellow-800";
    case "Overdue": return "bg-red-100 text-red-800";
    case "Paid": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
  }
}
