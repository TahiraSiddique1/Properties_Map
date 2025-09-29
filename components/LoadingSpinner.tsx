"use client";

interface Props {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export default function LoadingSpinner({ message = "Loading...", size = "md" }: Props) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className="text-center">
        <div className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]} mx-auto mb-2`} />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}
