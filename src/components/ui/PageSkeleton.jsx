import React from 'react';
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("animate-pulse rounded-[1rem] bg-stone-200/50", className)}
      {...props}
    />
  );
}

export default function PageSkeleton() {
  return (
    <div className="space-y-6 opacity-60">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-[1.5rem] border border-stone-100 h-auto md:h-24 gap-4">
            <div className="space-y-3 w-full md:w-auto">
                <Skeleton className="h-7 w-48 bg-stone-300/50" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
                <Skeleton className="h-10 w-24 rounded-xl" />
                <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
        </div>
        
        {/* KPI Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Skeleton className="h-28 rounded-[2rem]" />
            <Skeleton className="h-28 rounded-[2rem]" />
            <Skeleton className="h-28 rounded-[2rem]" />
            <Skeleton className="h-28 rounded-[2rem]" />
        </div>

        {/* Content Skeleton (Grid Split) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 rounded-[2rem] lg:col-span-1" />
            <Skeleton className="h-80 rounded-[2rem] lg:col-span-2" />
        </div>
        
        {/* Table Skeleton */}
        <Skeleton className="h-64 rounded-[2rem] w-full" />
    </div>
  );
}