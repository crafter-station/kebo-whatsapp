import type { ReactElement } from "react";
import type { ExpenseCategory } from "@/db/schema";
import {
	categoryInfo,
	colors,
	formatCurrency,
	formatTime,
	renderToPng,
} from "../index";

export interface ExpenseAddedData {
	description: string;
	amount: number;
	currency: string;
	category: ExpenseCategory;
	vendor?: string;
	spentAt: Date;
}

function ExpenseAddedTemplate({
	data,
}: {
	data: ExpenseAddedData;
}): ReactElement {
	const category = categoryInfo[data.category];

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
					marginBottom: "24px",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: "48px",
						height: "48px",
						borderRadius: "50%",
						backgroundColor: colors.expense,
						marginRight: "16px",
					}}
				>
					<span style={{ fontSize: "24px", color: "white" }}>$</span>
				</div>
				<span
					style={{
						fontSize: "24px",
						fontWeight: 600,
						color: colors.text,
					}}
				>
					Expense Logged
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

			{/* Amount - Large and prominent */}
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
					{formatCurrency(data.amount, data.currency)}
				</span>
			</div>

			{/* Description */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					marginBottom: "24px",
				}}
			>
				<span
					style={{
						fontSize: "28px",
						fontWeight: 600,
						color: colors.text,
						marginBottom: "8px",
						textAlign: "center",
					}}
				>
					{data.description}
				</span>
				{data.vendor && (
					<span
						style={{
							fontSize: "18px",
							color: colors.textSecondary,
							textAlign: "center",
						}}
					>
						at {data.vendor}
					</span>
				)}
			</div>

			{/* Category and time info */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					gap: "24px",
					padding: "16px 24px",
					borderRadius: "12px",
					backgroundColor: colors.surface,
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
							width: "36px",
							height: "36px",
							borderRadius: "50%",
							backgroundColor: category.color,
							marginRight: "12px",
						}}
					>
						<span style={{ fontSize: "14px", fontWeight: 600, color: "white" }}>
							{category.icon}
						</span>
					</div>
					<span
						style={{
							fontSize: "16px",
							fontWeight: 500,
							color: colors.text,
						}}
					>
						{category.label}
					</span>
				</div>

				{/* Separator */}
				<div
					style={{
						display: "flex",
						width: "2px",
						height: "24px",
						backgroundColor: colors.border,
					}}
				/>

				{/* Time */}
				<span
					style={{
						fontSize: "16px",
						color: colors.textSecondary,
					}}
				>
					{formatTime(data.spentAt)}
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
