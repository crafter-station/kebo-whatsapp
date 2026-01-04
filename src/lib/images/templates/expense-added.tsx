import type { ReactElement } from "react";
import type { ExpenseCategory } from "@/db/schema";
import {
	categoryInfo,
	colors,
	formatCurrency,
	formatTime,
	renderToPng,
} from "../index";
import {
	getTranslations,
	getCategoryName,
	type SupportedLocale,
} from "@/lib/i18n";

export interface ExpenseAddedData {
	description: string;
	amount: number;
	currency: string;
	category: ExpenseCategory;
	vendor?: string;
	spentAt: Date;
	language?: SupportedLocale;
}

function ExpenseAddedTemplate({
	data,
}: {
	data: ExpenseAddedData;
}): ReactElement {
	const category = categoryInfo[data.category];
	const t = getTranslations(data.language || "en");
	const locale = data.language === "es" ? "es-ES" : "en-US";
	const categoryName = getCategoryName(data.category, data.language || "en");

	// Brand colors
	const brandPurple = "#8B5CF6";
	const brandLavender = "#F5F3FF";
	const brandRed = "#EF4444";
	const brandDarkText = "#111827";

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
					alignItems: "center",
					marginBottom: "32px",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: "52px",
						height: "52px",
						borderRadius: "50%",
						backgroundColor: brandPurple,
						marginRight: "16px",
						border: `3px solid ${brandPurple}`,
					}}
				>
					<span style={{ fontSize: "32px", color: "white", fontWeight: 700 }}>$</span>
				</div>
				<span
					style={{
						fontSize: "26px",
						fontWeight: 600,
						color: brandDarkText,
					}}
				>
					{t.expenseLogged}
				</span>
			</div>

			{/* Amount - Large and prominent */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					marginBottom: "24px",
				}}
			>
				<span
					style={{
						fontSize: "64px",
						fontWeight: 700,
						color: brandRed,
						lineHeight: 1,
					}}
				>
					{formatCurrency(data.amount, data.currency)}
				</span>
			</div>

			{/* Description */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					marginBottom: "32px",
					alignItems: "center",
				}}
			>
				<span
					style={{
						fontSize: "24px",
						fontWeight: 600,
						color: brandDarkText,
						marginBottom: "8px",
						textAlign: "center",
					}}
				>
					{data.description}
				</span>
				{data.vendor && (
					<span
						style={{
							fontSize: "20px",
							fontWeight: 500,
							color: brandDarkText,
							textAlign: "center",
						}}
					>
						{t.at} {data.vendor}
					</span>
				)}
			</div>

			{/* Category and time card */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "20px 28px",
					borderRadius: "16px",
					backgroundColor: brandLavender,
					boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
				}}
			>
				{/* Category */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: "40px",
							height: "40px",
							borderRadius: "50%",
							backgroundColor: brandPurple,
							marginRight: "14px",
						}}
					>
						<span style={{ fontSize: "16px", fontWeight: 600, color: "white" }}>
							{category.icon}
						</span>
					</div>
					<span
						style={{
							fontSize: "18px",
							fontWeight: 600,
							color: brandDarkText,
						}}
					>
						{categoryName}
					</span>
				</div>

				{/* Time */}
				<span
					style={{
						fontSize: "16px",
						fontWeight: 500,
						color: "#6B7280",
					}}
				>
					{formatTime(data.spentAt, locale)}
				</span>
			</div>
		</div>
	);
}

export async function renderExpenseAdded(
	data: ExpenseAddedData,
): Promise<Buffer> {
	return renderToPng(<ExpenseAddedTemplate data={data} />, {
		width: 600,
		height: 450,
	});
}
