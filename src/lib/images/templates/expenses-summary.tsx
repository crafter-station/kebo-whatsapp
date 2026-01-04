import type { ReactElement } from "react";
import type { ExpenseCategory } from "@/db/schema";
import {
	categoryInfo,
	colors,
	formatCurrency,
	formatDate,
	renderToPng,
} from "../index";
import {
	getTranslations,
	formatExpenseCount,
	translatePeriodLabel,
	getCategoryName,
	type SupportedLocale,
} from "@/lib/i18n";

export interface CategoryBreakdown {
	category: ExpenseCategory;
	total: number;
	count: number;
}

export interface ExpensesSummaryData {
	periodLabel: string; // "Today", "This Week", "This Month", etc.
	startDate: Date;
	endDate: Date;
	totalAmount: number;
	currency: string;
	entryCount: number;
	byCategory: CategoryBreakdown[];
	language?: SupportedLocale;
}

function CategoryBar({
	category,
	total,
	count,
	maxTotal,
	currency,
	language,
}: {
	category: ExpenseCategory;
	total: number;
	count: number;
	maxTotal: number;
	currency: string;
	language?: SupportedLocale;
}): ReactElement {
	const info = categoryInfo[category];
	const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
	const categoryName = getCategoryName(category, language || "en");
	const brandPurple = "#8B5CF6";

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				marginBottom: "18px",
				width: "100%",
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "10px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center" }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: "32px",
							height: "32px",
							borderRadius: "50%",
							backgroundColor: brandPurple,
							marginRight: "12px",
						}}
					>
						<span style={{ fontSize: "13px", fontWeight: 600, color: "white" }}>
							{info.icon}
						</span>
					</div>
					<span
						style={{
							fontSize: "16px",
							fontWeight: 600,
							color: "#111827",
						}}
					>
						{categoryName}
					</span>
					<span
						style={{
							fontSize: "14px",
							color: "#6B7280",
							marginLeft: "10px",
							fontWeight: 500,
						}}
					>
						({count})
					</span>
				</div>
				<span
					style={{
						fontSize: "16px",
						fontWeight: 700,
						color: "#EF4444",
					}}
				>
					{formatCurrency(total, currency)}
				</span>
			</div>
			<div
				style={{
					display: "flex",
					width: "100%",
					height: "10px",
					borderRadius: "8px",
					backgroundColor: "#F5F3FF",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						display: "flex",
						width: `${percentage}%`,
						height: "100%",
						backgroundColor: brandPurple,
						borderRadius: "8px",
					}}
				/>
			</div>
		</div>
	);
}

function ExpensesSummaryTemplate({
	data,
}: {
	data: ExpensesSummaryData;
}): ReactElement {
	const t = getTranslations(data.language || "en");
	const locale = data.language === "es" ? "es-ES" : "en-US";
	const translatedPeriodLabel = translatePeriodLabel(
		data.periodLabel,
		data.language || "en",
	);

	// Brand colors
	const brandPurple = "#8B5CF6";
	const brandLavender = "#F5F3FF";
	const brandRed = "#EF4444";
	const brandDarkText = "#111827";

	// Sort categories by total, descending
	const sortedCategories = [...data.byCategory].sort(
		(a, b) => b.total - a.total,
	);
	const maxCategoryTotal =
		sortedCategories.length > 0 ? sortedCategories[0].total : 0;

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				backgroundColor: colors.background,
				padding: "40px",
				fontFamily: "Inter",
				position: "relative",
			}}
		>
			{/* Kebo Logo - Top Right */}
			<div
				style={{
					position: "absolute",
					top: "20px",
					right: "20px",
					display: "flex",
					alignItems: "center",
					gap: "8px",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: "40px",
						height: "40px",
						borderRadius: "8px",
						backgroundColor: brandPurple,
					}}
				>
					<span style={{ fontSize: "28px", color: "white", fontWeight: 700 }}>K</span>
				</div>
				<span style={{ fontSize: "24px", fontWeight: 700, color: brandPurple }}>
					ebo
				</span>
			</div>

			{/* Header */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					marginBottom: "28px",
				}}
			>
				<span
					style={{
						fontSize: "28px",
						fontWeight: 700,
						color: brandDarkText,
						marginBottom: "6px",
					}}
				>
					{translatedPeriodLabel}
				</span>
				<span
					style={{
						fontSize: "15px",
						fontWeight: 500,
						color: "#6B7280",
					}}
				>
					{formatDate(data.startDate, locale)} - {formatDate(data.endDate, locale)}
				</span>
			</div>

			{/* Main total display */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					marginBottom: "36px",
					padding: "24px",
					borderRadius: "16px",
					backgroundColor: brandLavender,
					boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
				}}
			>
				<span
					style={{
						fontSize: "14px",
						fontWeight: 600,
						color: brandPurple,
						marginBottom: "8px",
						textTransform: "uppercase",
						letterSpacing: "0.5px",
					}}
				>
					{t.totalSpent}
				</span>
				<span
					style={{
						fontSize: "52px",
						fontWeight: 700,
						color: brandRed,
						lineHeight: 1,
					}}
				>
					{formatCurrency(data.totalAmount, data.currency)}
				</span>
			</div>

			{/* Category breakdown */}
			{sortedCategories.length > 0 && (
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						width: "100%",
						marginBottom: "24px",
					}}
				>
					{sortedCategories.slice(0, 5).map((cat) => (
						<CategoryBar
							key={cat.category}
							category={cat.category}
							total={cat.total}
							count={cat.count}
							maxTotal={maxCategoryTotal}
							currency={data.currency}
							language={data.language}
						/>
					))}
				</div>
			)}

			{/* Footer */}
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					padding: "18px",
					borderRadius: "12px",
					backgroundColor: "#F9FAFB",
					marginTop: "auto",
					border: `2px solid ${brandLavender}`,
				}}
			>
				<span
					style={{
						fontSize: "15px",
						fontWeight: 600,
						color: brandPurple,
					}}
				>
					{data.entryCount} {formatExpenseCount(data.entryCount, data.language || "en")}{" "}
					{t.expensesLogged}
				</span>
			</div>
		</div>
	);
}

export async function renderExpensesSummary(
	data: ExpensesSummaryData,
): Promise<Buffer> {
	return renderToPng(<ExpensesSummaryTemplate data={data} />, {
		width: 600,
		height: 650,
	});
}
