import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetPurchasedCoursesQuery } from "@/features/api/purchaseApi";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, IndianRupee, ShoppingBag, Activity, AlertCircle } from "lucide-react";

const Dashboard = () => {
  const { data, isError, isLoading } = useGetPurchasedCoursesQuery();

  const purchasedCourse = React.useMemo(
    () => data?.purchasedCourse || [],
    [data]
  );

  const courseStats = React.useMemo(() => {
    const map = new Map();

    purchasedCourse.forEach((purchase) => {
      const course = purchase.courseId;
      if (!course) return;

      const id = course._id?.toString() || String(course.id || "");
      const existing =
        map.get(id) || {
          id,
          title: course.courseTitle || "Untitled course",
          level: course.courseLevel,
          price: course.coursePrice || 0,
          totalRevenue: 0,
          totalSales: 0,
        };

      existing.totalRevenue += purchase.amount || course.coursePrice || 0;
      existing.totalSales += 1;
      map.set(id, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [purchasedCourse]);

  const chartData = React.useMemo(
    () =>
      courseStats.map((course) => ({
        name: course.title,
        revenue: course.totalRevenue,
      })),
    [courseStats]
  );

  const totalRevenue = purchasedCourse.reduce(
    (acc, element) => acc + (element?.amount || 0),
    0
  );

  const totalSales = purchasedCourse.length;
  const averageOrderValue =
    totalSales > 0 ? Math.round(totalRevenue / totalSales) : 0;
  const averageRevenuePerCourse =
    courseStats.length > 0 ? Math.round(totalRevenue / courseStats.length) : 0;
  const isEmpty = !isLoading && !isError && purchasedCourse.length === 0;

  const topCourses = React.useMemo(
    () => courseStats.slice(0, 3),
    [courseStats]
  );

  const recentSales = React.useMemo(
    () =>
      [...purchasedCourse]
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.updatedAt || 0) -
            new Date(a.createdAt || a.updatedAt || 0)
        )
        .slice(0, 5),
    [purchasedCourse]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Instructor Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Overview of your course performance, sales, and revenue.
          </p>
        </div>
      </div>

      {/* Error banner */}
      {isError && (
        <Card className="border-red-200 bg-red-50/80 dark:bg-red-900/20">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700 dark:text-red-200">
              Unable to load dashboard data. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top stats */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-sm border-none bg-white dark:bg-zinc-900 ring-1 ring-slate-900/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Sales
            </CardTitle>
            <ShoppingBag className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                {totalSales}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total purchases across all courses.</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white dark:bg-zinc-900 ring-1 ring-slate-900/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Revenue
            </CardTitle>
            <IndianRupee className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                ₹{totalRevenue}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Gross revenue from all completed purchases.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white dark:bg-zinc-900 ring-1 ring-slate-900/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Avg. Order Value
            </CardTitle>
            <Activity className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-50">
                ₹{averageOrderValue}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Average revenue per purchase across your catalog.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3 items-start">
        <Card className="shadow-sm border-none bg-white dark:bg-zinc-900 ring-1 ring-slate-900/5 xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Revenue by course</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Total earnings per course based on completed purchases.
              </p>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="h-64 flex flex-col justify-center gap-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : isEmpty ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                You do not have any course purchases yet. Once students start buying your courses,
                revenue analytics will appear here.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                >
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#9ca3af"
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <ReferenceLine
                    y={averageRevenuePerCourse}
                    stroke="#4b5563"
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                  />
                  <Tooltip
                    formatter={(value) => [`₹${value}`, "Revenue"]}
                    labelFormatter={(label) => `Course: ${label}`}
                    contentStyle={{
                      backgroundColor: "#020617",
                      borderRadius: "0.5rem",
                      border: "1px solid #1f2937",
                      color: "#e5e7eb",
                      fontSize: "0.75rem",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="none"
                    fill="url(#revenueGradient)"
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 2, stroke: "#0f766e", fill: "#10b981" }}
                    activeDot={{ r: 6 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-sm border-none bg-white dark:bg-zinc-900 ring-1 ring-slate-900/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top performing courses</CardTitle>
            </CardHeader>
            <CardContent>
              {isEmpty ? (
                <p className="text-sm text-muted-foreground">
                  No sales data available yet. Once your courses start selling, your best performers will be highlighted here.
                </p>
              ) : (
                <div className="space-y-3">
                  {topCourses.map((course, index) => (
                    <div
                      key={course.id || index}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {course.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {course.totalSales} sales · ₹{course.totalRevenue} revenue
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        #{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-none bg-white dark:bg-zinc-900 ring-1 ring-slate-900/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Recent sales</CardTitle>
            </CardHeader>
            <CardContent>
              {isEmpty ? (
                <p className="text-sm text-muted-foreground">
                  No purchases recorded yet. New sales will show up here in real time.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentSales.map((purchase) => {
                    const course = purchase.courseId || {};
                    const createdAt = new Date(
                      purchase.createdAt || purchase.updatedAt || Date.now()
                    );
                    const dateLabel = createdAt.toLocaleDateString();

                    return (
                      <div
                        key={purchase._id}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {course.courseTitle || "Untitled course"}
                          </p>
                          <p className="text-xs text-muted-foreground">{dateLabel}</p>
                        </div>
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          ₹{purchase.amount || course.coursePrice || 0}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

