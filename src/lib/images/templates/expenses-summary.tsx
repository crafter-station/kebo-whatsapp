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

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				marginBottom: "16px",
				width: "100%",
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "8px",
				}}
			>
				<div style={{ display: "flex", alignItems: "center" }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: "24px",
							height: "24px",
							borderRadius: "50%",
							backgroundColor: info.color,
							marginRight: "8px",
						}}
					>
						<span style={{ fontSize: "10px", fontWeight: 600, color: "white" }}>
							{info.icon}
						</span>
					</div>
					<span
						style={{
							fontSize: "14px",
							fontWeight: 500,
							color: colors.text,
						}}
					>
						{categoryName}
					</span>
					<span
						style={{
							fontSize: "12px",
							color: colors.textSecondary,
							marginLeft: "8px",
						}}
					>
						({count})
					</span>
				</div>
				<span
					style={{
						fontSize: "14px",
						fontWeight: 600,
						color: info.color,
					}}
				>
					{formatCurrency(total, currency)}
				</span>
			</div>
			<div
				style={{
					display: "flex",
					width: "100%",
					height: "8px",
					borderRadius: "4px",
					backgroundColor: colors.surface,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						display: "flex",
						width: `${percentage}%`,
						height: "100%",
						backgroundColor: info.color,
						borderRadius: "4px",
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
			}}
		>
			{/* Header */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					marginBottom: "24px",
				}}
			>
				<span
					style={{
						fontSize: "24px",
						fontWeight: 600,
						color: colors.text,
						marginBottom: "4px",
					}}
				>
					{translatedPeriodLabel}
				</span>
				<span
					style={{
						fontSize: "14px",
						color: colors.textSecondary,
					}}
				>
					{formatDate(data.startDate, locale)} - {formatDate(data.endDate, locale)}
				</span>
			</div>

			{/* Divider */}
			<div
				style={{
					display: "flex",
					width: "100%",
					height: "2px",
					backgroundColor: colors.border,
					marginBottom: "32px",
				}}
			/>

			{/* Main total display */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					marginBottom: "32px",
				}}
			>
				<span
					style={{
						fontSize: "56px",
						fontWeight: 700,
						color: colors.expense,
					}}
				>
					{formatCurrency(data.totalAmount, data.currency)}
				</span>
				<span
					style={{
						fontSize: "16px",
						color: colors.textSecondary,
					}}
				>
					{t.totalSpent}
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
					padding: "16px",
					borderRadius: "12px",
					backgroundColor: colors.surface,
					marginTop: "auto",
				}}
			>
				<span
					style={{
						fontSize: "14px",
						color: colors.textSecondary,
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
